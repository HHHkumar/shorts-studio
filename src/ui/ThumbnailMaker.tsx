import React, { useState } from 'react';
import { api } from '../lib/api';
import type { DesignSettings, QuizContent } from '../lib/types';
import { ErrorNote, Note, Select, Spinner, TextInput } from './controls';

// ---------------------------------------------------------------------------
// The thumbnail.
//
// Rendered by Remotion at YouTube's 1280x720, using the same theme as the
// video, so the two look like one piece of work rather than a video and a
// separate poster somebody made afterwards.
//
// The preview below is shown at 320 pixels wide on purpose. YouTube shows a
// thumbnail at roughly 210 in a feed, and a design checked at full size is
// checked at the one size nobody sees it. If the text is not readable in that
// small box, it is not readable.
// ---------------------------------------------------------------------------

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
}> = ({ content, design, suggested }) => {
  const [title, setTitle] = useState(suggested || content.hook || content.question || '');
  const [kicker, setKicker] = useState(content.subject || '');
  const [badge, setBadge] = useState('');
  const [figure, setFigure] = useState('');
  const [symbol, setSymbol] = useState((content.motifSymbols || [])[0] || '');
  const [layout, setLayout] = useState('statement');

  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const words = title.replace(/\*/g, '').trim().split(/\s+/).filter(Boolean).length;

  const make = async () => {
    setBusy(true);
    setError(null);
    try {
      const out = await api.thumbnail({
        content, design, title, kicker, badge, figure, symbol, layout,
      });
      // The filename changes every time, so the browser cannot show a stale one.
      setUrl(out.url);
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
        A 1280 × 720 image in the same colours as the video. Rendered on your machine, so it costs
        nothing and you can make as many as you like.
      </p>

      <div className="grid">
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
            hint="One emoji, drawn large on the right."
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
                style={{ width: 320, borderRadius: 8, border: '1px solid var(--line)', display: 'block' }}
              />
              <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 6 }}>
                Roughly feed size — judge it here
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <img
                src={url}
                alt="The thumbnail, larger"
                style={{ width: '100%', borderRadius: 10, border: '1px solid var(--line)', display: 'block' }}
              />
              <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 6 }}>
                Full size — 1280 × 720
              </div>
            </div>
          </div>

          <Note kind="info" title="Read the small one, not the big one">
            YouTube shows a thumbnail about that wide in a feed. If you cannot read it in the left
            box at a glance, cut words out — shrinking the type is what makes thumbnails invisible.
          </Note>
        </>
      ) : null}
    </>
  );
};
