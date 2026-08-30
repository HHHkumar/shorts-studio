import React, { useState } from 'react';
import { api, type StockImage } from '../lib/api';
import type { QuizContent, ScriptLine } from '../lib/types';
import { ErrorNote, Note, Slider, Spinner } from './controls';

/**
 * Choose a backdrop photo for each scene.
 *
 * Nothing is applied automatically. A stock library will happily return a beach
 * photo for "gravity", and dropping that behind a physics question would make
 * the video look worse, not better - so every image is one the creator picked.
 */

/** Scenes where a photo would collide with what is already on screen. */
const SKIP_KINDS = new Set(['options', 'countdown']);

interface SceneCandidates {
  [sceneIndex: number]: StockImage[];
}

export const StockPicker: React.FC<{
  content: QuizContent;
  setContent: (updater: (prev: QuizContent) => QuizContent) => void;
  pexelsKey: string;
  orientation: string;
  showStock: boolean;
  stockOpacity: number;
  setStockOpacity: (v: number) => void;
}> = ({ content, setContent, pexelsKey, orientation, showStock, stockOpacity, setStockOpacity }) => {
  const [candidates, setCandidates] = useState<SceneCandidates>({});
  const [searching, setSearching] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [busyScene, setBusyScene] = useState<number | null>(null);

  // A stable folder name so re-picking overwrites instead of piling up.
  const jobId = 'job-' + Math.abs(hash(content.question)).toString(36);

  const eligible = content.script
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => !SKIP_KINDS.has(line.kind));

  const chosenCount = content.script.filter((l) => l.stockSrc).length;

  const searchAll = async () => {
    setSearching(true);
    setError(null);
    setProgress({ done: 0, total: eligible.length });

    const found: SceneCandidates = {};
    let done = 0;

    // Sequential on purpose: both libraries rate-limit, and a long explainer
    // can have twenty scenes.
    for (const { line, index } of eligible) {
      const query = (line.imageQuery || '').trim() || fallbackQuery(line, content);
      if (query) {
        try {
          found[index] = await api.searchStock(pexelsKey.trim(), query, orientation);
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
          break;
        }
      }
      done += 1;
      setProgress({ done, total: eligible.length });
    }

    setCandidates(found);
    setSearching(false);
  };

  const choose = async (index: number, image: StockImage) => {
    setBusyScene(index);
    setError(null);
    try {
      const { src } = await api.pickStock(image.full, image.id, jobId);
      setContent((prev) => ({
        ...prev,
        script: prev.script.map((line, i) =>
          i === index
            ? { ...line, stockSrc: src, stockCredit: image.credit, stockId: image.id }
            : line,
        ),
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyScene(null);
    }
  };

  const clear = (index: number) => {
    setContent((prev) => ({
      ...prev,
      script: prev.script.map((line, i) =>
        i === index ? { ...line, stockSrc: '', stockCredit: '', stockId: '' } : line,
      ),
    }));
  };

  const setQuery = (index: number, value: string) => {
    setContent((prev) => ({
      ...prev,
      script: prev.script.map((line, i) => (i === index ? { ...line, imageQuery: value } : line)),
    }));
  };

  return (
    <>
      {!pexelsKey.trim() ? (
        // NASA needs no key, so searching still works - just with one library.
        <Note kind="info" title="Searching NASA only">
          Add a free <b>Pexels key</b> on step 1 to widen the search. Without it you still get NASA's
          public-domain library, which is excellent for space, physics and earth science but thin for
          chemistry, biology and maths.
        </Note>
      ) : null}

      <Note kind="info" title="Nothing is applied for you">
        A photo library will cheerfully return a beach for "gravity". Search, then pick only the
        images that genuinely fit — an unrelated backdrop makes a science video look worse, not better.
        Scenes you skip simply keep the plain background.
      </Note>

      <ErrorNote error={error} />

      <div className="actions">
        <button className="btn" onClick={searchAll} disabled={searching}>
          {searching ? <Spinner /> : '🖼️'}{' '}
          {Object.keys(candidates).length ? 'Search again' : 'Find backdrop photos'}
        </button>
        <div className="spacer" />
        <span style={{ alignSelf: 'center', color: 'var(--dim)', fontSize: 14 }}>
          {chosenCount} of {eligible.length} scenes have a photo
        </span>
      </div>

      {searching ? (
        <>
          <div className="bar">
            <div style={{ width: (progress.total ? (progress.done / progress.total) * 100 : 5) + '%' }} />
          </div>
          <div className="progress-line">
            <span>Searching Pexels and NASA…</span>
            <span>
              {progress.done} / {progress.total}
            </span>
          </div>
        </>
      ) : null}

      {chosenCount > 0 ? (
        <div className="grid" style={{ marginTop: 14 }}>
          <Slider
            label="How strongly the photo shows"
            value={stockOpacity}
            min={0.1}
            max={0.7}
            step={0.02}
            onChange={setStockOpacity}
            hint={
              showStock
                ? 'Around 0.3 reads as atmosphere. Higher starts to fight the text.'
                : 'Turn "Show backdrop photos" back on to see this.'
            }
          />
        </div>
      ) : null}

      {Object.keys(candidates).length ? (
        <div className="stock-list">
          {eligible.map(({ line, index }) => {
            const options = candidates[index] || [];
            return (
              <div className="stock-scene" key={index}>
                <div className="stock-head">
                  <span className="kind">{line.kind}</span>
                  <input
                    type="text"
                    value={line.imageQuery || ''}
                    placeholder="search words for this scene"
                    onChange={(e) => setQuery(index, e.target.value)}
                  />
                  {line.stockSrc ? (
                    <button className="link-btn" onClick={() => clear(index)}>
                      remove
                    </button>
                  ) : null}
                </div>

                {options.length ? (
                  <div className="stock-grid">
                    {options.map((image) => (
                      <button
                        key={image.id}
                        className={'stock-thumb' + (line.stockId === image.id ? ' active' : '')}
                        title={image.credit}
                        disabled={busyScene === index}
                        onClick={() => choose(index, image)}
                      >
                        <img src={image.thumb} alt="" loading="lazy" />
                        <span className={'prov prov-' + image.provider}>{image.provider}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="stock-empty">
                    {line.imageQuery
                      ? 'Nothing found. Try different search words above, then search again.'
                      : 'Gemini judged that no honest photo exists for this scene.'}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : null}
    </>
  );
};

/** If Gemini left the query empty we do not invent one for a talking beat. */
function fallbackQuery(line: ScriptLine, content: QuizContent): string {
  if (line.kind === 'hook' || line.kind === 'outro') return content.topic || content.subject;
  return '';
}

function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
  return h;
}
