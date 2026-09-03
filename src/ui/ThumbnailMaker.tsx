import React, { useState } from 'react';
import { api } from '../lib/api';
import type { DesignSettings, QuizContent } from '../lib/types';
import { ErrorNote, Note, Select, Spinner, TextInput } from './controls';

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
}> = ({ content, design, suggested, onThumbnail }) => {
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

  const words = title.replace(/\*/g, '').trim().split(/\s+/).filter(Boolean).length;

  const make = async () => {
    setBusy(true);
    setError(null);
    try {
      const out = await api.thumbnail({
        content, design, title, kicker, badge, figure, symbol, layout, shape,
      });
      // The filename changes every time, so the browser cannot show a stale one.
      setUrl(out.url);
      if (onThumbnail) onThumbnail(out.fileName);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="section-title">Thumbnail</div>
      <p className="lede" style={{ marginTop: 0 }}>
        An image in the same colours as the video — 1280 × 720 for YouTube, or 1080 × 1920 for a
        Short. Rendered on your machine, so it costs nothing and you can make as many as you like.
      </p>

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
          Drawing it. The first one in a session takes longer because the engine has to start up;
          after that it is a couple of seconds.
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
