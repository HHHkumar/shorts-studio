import React, { useState } from 'react';
import { api } from '../lib/api';
import { useStoredState } from '../lib/store';
import { getTheme } from '../lib/theme';
import type { DesignSettings, QuizContent } from '../lib/types';
import { Check, ErrorNote, Note, Select, Spinner, TextArea, TextInput } from './controls';

// ---------------------------------------------------------------------------
// The thumbnail.
//
// Rendered by Remotion in the same theme as the video, so the two look like one
// piece of work rather than a video and a separate poster somebody made
// afterwards. Two shapes: 16:9 for a YouTube cover, 9:16 for a Short.
//
// The small preview is deliberately the width the thing is actually seen at -
// about 320 for a 16:9 row, about 200 for a portrait shelf. A design checked at
// full size is checked at the one size nobody sees it, so that box, not the big
// one, is the test.
// ---------------------------------------------------------------------------

const SHAPES = [
  { id: 'landscape', label: '16:9 — YouTube cover image' },
  { id: 'portrait', label: '9:16 — Shorts, Reels, TikTok' },
];

const LAYOUTS = [
  { id: 'statement', label: 'Statement — one bold claim' },
  { id: 'question', label: 'Question — a big ? beside the text' },
  { id: 'number', label: 'Number — a figure, then the words' },
  { id: 'split', label: 'Split — text on the left, a symbol on the right' },
];

export const ThumbnailMaker: React.FC<{
  content: QuizContent;
  design: DesignSettings;
  /** Gemini's suggested wording, when the metadata has been written. */
  suggested?: string;
  /** Told the filename whenever one is made, so the upload kit can include it. */
  onThumbnail?: (fileName: string) => void;
  geminiKey?: string;
  geminiModel?: string;
  googleImageModels?: { id: string; label: string }[];
  /** The title picked on this step, which the Gemini design is built from. */
  chosenTitle?: string;
  description?: string;
}> = ({
  content, design, suggested, onThumbnail,
  geminiKey = '', geminiModel = 'gemini-2.5-flash', googleImageModels = [], chosenTitle = '', description = '',
}) => {
  const [title, setTitle] = useState(suggested || content.hook || content.question || '');
  const [kicker, setKicker] = useState(content.subject || '');
  const [badge, setBadge] = useState('');
  const [figure, setFigure] = useState('');
  const [symbol, setSymbol] = useState((content.motifSymbols || [])[0] || '');
  const [layout, setLayout] = useState('statement');
  // Default to the shape of the video being made - that is the cover it needs.
  const [shape, setShape] = useState(design.orientation === 'landscape' ? 'landscape' : 'portrait');

  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Gemini's design: the picture behind the words, and whether to use it.
  const [scene, setScene] = useState('');
  const [art, setArt] = useState('');
  const [useArt, setUseArt] = useState(true);
  const [paint, setPaint] = useStoredState('thumbPaintArt', true);
  const [imageModel, setImageModel] = useStoredState('thumbImageModel', '');
  const [stage, setStage] = useState('');
  const [notes, setNotes] = useState<string[]>([]);

  const words = title.replace(/\*/g, '').trim().split(/\s+/).filter(Boolean).length;
  const modelId = imageModel || googleImageModels[0]?.id || '';
  const accent = getTheme(design).accent;

  type Fields = { title: string; kicker: string; badge: string; figure: string; symbol: string; layout: string; art: string };
  const current = (): Fields => ({ title, kicker, badge, figure, symbol, layout, art: useArt ? art : '' });

  /** Render with these fields - passed in, because state set a moment ago has not landed yet. */
  const render = async (fields: Fields) => {
    const out = await api.thumbnail({ content, design, shape, ...fields });
    // The filename changes every time, so the browser cannot show a stale one.
    setUrl(out.url);
    if (onThumbnail) onThumbnail(out.fileName);
  };

  const run = async (label: string, work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setStage(label);
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setStage('');
    }
  };

  const make = () => run('Drawing it…', () => render(current()));

  const paintArt = async (forScene: string) => {
    setStage('Gemini is painting the picture - this takes 10 to 30 seconds…');
    const out = await api.thumbnailArt({ apiKey: geminiKey.trim(), modelId, scene: forScene, shape, accent });
    setArt(out.src);
    setUseArt(true);
    return out.src;
  };

  const design_ = () => run('Gemini is designing the thumbnail from the title and description…', async () => {
    setNotes([]);
    const { brief } = await api.thumbnailBrief({
      apiKey: geminiKey.trim(),
      model: geminiModel,
      content,
      title: chosenTitle || suggested || content.question,
      description,
      shape,
    });
    setTitle(brief.title);
    setKicker(brief.kicker);
    setBadge(brief.badge);
    setFigure(brief.figure);
    setSymbol(brief.symbol);
    setLayout(brief.layout);
    setScene(brief.scene);
    setNotes(brief.notes);
    const drawn = paint ? await paintArt(brief.scene) : (useArt ? art : '');
    setStage('Setting the words over it…');
    await render({ ...brief, art: drawn });
  });

  const repaint = () => run('Painting…', async () => {
    const drawn = await paintArt(scene);
    setStage('Setting the words over it…');
    await render({ ...current(), art: drawn });
  });

  return (
    <>
      <div className="section-title">Thumbnail</div>
      <p className="lede" style={{ marginTop: 0 }}>
        An image in the same colours as the video — 1280 × 720 for YouTube, or 1080 × 1920 for a
        Short. The words are always rendered on your machine, free, as often as you like; only a
        picture painted by Gemini costs anything, and you can repaint it or keep it while you change
        the words.
      </p>

      <div className="gemini-thumb">
        <div className="gemini-thumb-head">
          <b>✨ Design it with Gemini</b>
          <span>
            Gemini reads {chosenTitle ? 'the title you picked' : 'the question'}
            {description ? ' and the description' : ''}, writes a short scroll-stopping headline,
            picks the layout, and paints a picture for behind it. The words are set as real type on
            top, so they are always spelled right - and a quiz cover never shows the answer.
          </span>
        </div>
        <div className="grid">
          <Select
            label="Picture model"
            value={modelId}
            options={googleImageModels}
            onChange={setImageModel}
            disabled={!paint}
            hint="Image generation needs billing on the Gemini key; the headline alone is free-tier."
          />
          <div className="field">
            <label>&nbsp;</label>
            <Check
              label="Paint a background picture"
              checked={paint}
              onChange={setPaint}
              hint="Off: Gemini writes the words and layout only, over the video's own backdrop."
            />
          </div>
        </div>
        <div className="actions" style={{ marginTop: 0 }}>
          <button className="btn primary" onClick={design_} disabled={busy || !geminiKey.trim()}>
            {busy && stage.startsWith('Gemini is designing') ? <Spinner /> : '✨'} Design with Gemini
          </button>
        </div>
        {!geminiKey.trim() ? (
          <Note kind="info">Add a Gemini key on the Keys step to let Gemini design the thumbnail.</Note>
        ) : null}
        {notes.map((n) => (
          <Note key={n} kind="warn">{n}</Note>
        ))}
        {scene ? (
          <>
            <TextArea
              label="The picture"
              value={scene}
              onChange={setScene}
              rows={2}
              hint="Edit the description and repaint, or keep the picture and just change the words below."
            />
            <div className="actions" style={{ marginTop: 0 }}>
              <button className="btn" onClick={repaint} disabled={busy || !scene.trim() || !geminiKey.trim()}>
                🎨 {art ? 'Repaint the picture' : 'Paint the picture'}
              </button>
              {art ? (
                <Check label="Use the picture" checked={useArt} onChange={setUseArt} />
              ) : null}
            </div>
          </>
        ) : null}
      </div>

      <div className="grid">
        <Select
          label="Shape"
          value={shape}
          options={SHAPES}
          onChange={setShape}
          hint="Defaults to the shape of the video you just made. A Short needs the portrait one."
        />
        <Select
          label="Layout"
          value={layout}
          options={LAYOUTS}
          onChange={setLayout}
          hint="Statement works for most videos. Number is strong when the answer is a figure."
        />
        <TextInput
          label="Small line above (optional)"
          value={kicker}
          onChange={setKicker}
          placeholder="Power Generation"
          hint="Shown small and in the accent colour."
        />
      </div>

      <TextInput
        label="The big text"
        value={title}
        onChange={setTitle}
        placeholder="Which one hits the ground *first*?"
        hint={
          'Wrap a word in *asterisks* to colour it. ' +
          (words > 6
            ? '⚠ ' + words + ' words — six or fewer is what reads at feed size.'
            : words + ' words. Good.')
        }
      />

      <div className="grid">
        {layout === 'number' ? (
          <TextInput
            label="The figure"
            value={figure}
            onChange={setFigure}
            placeholder="8,760"
            hint="The number that carries the thumbnail. Keep it short."
          />
        ) : layout === 'split' ? (
          <TextInput
            label="The symbol"
            value={symbol}
            onChange={setSymbol}
            placeholder="⚡"
            hint={shape === 'portrait' ? 'One emoji, drawn large above the text.' : 'One emoji, drawn large on the right.'}
          />
        ) : (
          <div />
        )}
        <TextInput
          label="Corner tag (optional)"
          value={badge}
          onChange={setBadge}
          placeholder="GATE EE"
          hint="A short label in the top corner. Leave empty for none."
        />
      </div>

      <div className="actions">
        <button className="btn primary" onClick={make} disabled={busy || !title.trim()}>
          {busy ? <Spinner /> : '🖼️'} {url ? 'Make it again' : 'Make the thumbnail'}
        </button>
        {url ? (
          <a className="btn" href={url} download>
            ⬇ Save the PNG
          </a>
        ) : null}
      </div>

      {busy ? (
        <Note kind="info">
          {stage || 'Drawing it…'} The first thumbnail in a session takes longer because the engine
          has to start up; after that it is a couple of seconds.
        </Note>
      ) : null}

      <ErrorNote error={error} />

      {url && !busy ? (
        <>
          <div style={{ display: 'flex', gap: 22, alignItems: 'flex-start', marginTop: 14 }}>
            <div>
              <img
                src={url}
                alt="The thumbnail"
                style={{
                  width: shape === 'portrait' ? 200 : 320,
                  borderRadius: 8,
                  border: '1px solid var(--line)',
                  display: 'block',
                }}
              />
              <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 6 }}>
                Roughly feed size — judge it here
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <img
                src={url}
                alt="The thumbnail, larger"
                style={{
                  // Capped by height in portrait: a 1080x1920 at full column
                  // width is taller than the screen and pushes the note off it.
                  width: shape === 'portrait' ? 'auto' : '100%',
                  maxHeight: shape === 'portrait' ? 460 : undefined,
                  borderRadius: 10,
                  border: '1px solid var(--line)',
                  display: 'block',
                }}
              />
              <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 6 }}>
                Full size — {shape === 'portrait' ? '1080 × 1920' : '1280 × 720'}
              </div>
            </div>
          </div>

          <Note kind="info" title="Read the small one, not the big one">
            A thumbnail is shown about that wide wherever it appears — a YouTube feed, a Shorts
            shelf. If you cannot read it in the left box at a glance, cut words out; shrinking the
            type to fit more in is what makes thumbnails invisible.
          </Note>
        </>
      ) : null}
    </>
  );
};
