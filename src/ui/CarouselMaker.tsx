import React, { useState } from 'react';
import { api, type SeoPack } from '../lib/api';
import type { DesignSettings, QuizContent } from '../lib/types';
import { ErrorNote, Note, Spinner } from './controls';

// ---------------------------------------------------------------------------
// The carousel post.
//
// Square slides of the same question, for an Instagram or Facebook post that
// goes up beside the Reel: the question and options, the answer, the worked
// figure, the reasoning step by step, and a follow. Rendered on this machine in
// the video's own theme, so it costs nothing and matches the Reel.
// ---------------------------------------------------------------------------

type Result = Awaited<ReturnType<typeof api.carousel>>;

const KIND_NAMES: Record<string, string> = {
  question: 'Question',
  options: 'Options',
  answer: 'Answer',
  worked: 'Worked out',
  why: 'Why',
  outro: 'Follow',
};

export const CarouselMaker: React.FC<{
  content: QuizContent;
  design: DesignSettings;
  channelName: string;
  /** The metadata, when written - its Instagram and Facebook captions go in the zip. */
  seo: SeoPack | null;
  /** Told the folder whenever a carousel is made, so the upload kit can include it. */
  onCarousel?: (folder: string) => void;
}> = ({ content, design, channelName, seo, onCarousel }) => {
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(0);

  const make = async () => {
    setBusy(true);
    setError(null);
    try {
      const out = await api.carousel({ content, design, channelName, seo });
      setResult(out);
      setOpen(0);
      if (onCarousel) onCarousel(out.folder);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const slide = result?.slides[open];

  return (
    <>
      <div className="section-title">Carousel post — square, for Instagram and Facebook</div>
      <p className="lede" style={{ marginTop: 0 }}>
        The same question as a swipeable post of 1080 × 1080 slides: the question and options, the
        answer, the worked figure if there is one, the reasoning step by step, and a follow slide. Post
        it beside the Reel - the Reel gets watched, the carousel gets saved for revision.
      </p>

      {!channelName.trim() ? (
        <Note kind="info">
          Tip: fill in <b>Channel or site</b> at the top of this step - it goes on every slide.
        </Note>
      ) : null}
      {!seo ? (
        <Note kind="info">
          Write the metadata first if you want the Instagram and Facebook captions packed with the
          slides. The slides themselves do not need it.
        </Note>
      ) : null}

      <div className="actions">
        <button className="btn primary" onClick={make} disabled={busy}>
          {busy ? <Spinner /> : '🗂️'} {result ? 'Make it again' : 'Make the carousel'}
        </button>
        {result && !busy ? (
          <a className="btn" href={result.zipUrl} download={result.zipName}>
            ⬇ Save all {result.slides.length} slides (.zip)
          </a>
        ) : null}
      </div>

      {busy ? (
        <Note kind="info">
          Drawing each slide in the video's theme. A few seconds a slide - longer for the first one in
          a session, while the engine starts.
        </Note>
      ) : null}

      <ErrorNote error={error} />

      {result && !busy ? (
        <>
          {result.notes.map((n) => (
            <Note key={n} kind="info">{n}</Note>
          ))}

          <div className="carousel-strip" role="tablist" aria-label="Slides">
            {result.slides.map((s, i) => (
              <button
                key={s.url}
                role="tab"
                aria-selected={i === open}
                className={'carousel-thumb' + (i === open ? ' active' : '')}
                onClick={() => setOpen(i)}
                title={'Slide ' + (i + 1) + ': ' + (KIND_NAMES[s.kind] || s.kind)}
              >
                <img src={s.url} alt={'Slide ' + (i + 1)} />
                <span>{i + 1}. {KIND_NAMES[s.kind] || s.kind}</span>
              </button>
            ))}
          </div>

          {slide ? (
            <div className="carousel-view">
              <img src={slide.url} alt={'Slide ' + (open + 1) + ' of ' + result.slides.length} />
              <div className="carousel-nav">
                <button className="btn" onClick={() => setOpen(Math.max(0, open - 1))} disabled={open === 0}>
                  ← Previous
                </button>
                <span>{open + 1} / {result.slides.length}</span>
                <button className="btn" onClick={() => setOpen(Math.min(result.slides.length - 1, open + 1))}
                  disabled={open === result.slides.length - 1}>
                  Next →
                </button>
                <a className="btn ghost" href={slide.url} download={slide.fileName}>⬇ This slide</a>
              </div>
            </div>
          ) : null}

          <Note kind="good" title="Posting it">
            <p style={{ margin: 0 }}>
              <b>Instagram:</b> + → Post → select multiple, pick the slides in order, keep the square
              crop, and paste <code>caption-instagram.txt</code> from the zip. <b>Facebook:</b> Photo/video,
              select them all in order, paste <code>caption-facebook.txt</code>. The carousel is also
              packed into the upload kit below.
            </p>
          </Note>
        </>
      ) : null}
    </>
  );
};
