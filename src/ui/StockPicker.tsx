import React, { useState } from 'react';
import { api, type StockImage, type TopicForm } from '../lib/api';
import type { QuizContent, ScriptLine } from '../lib/types';
import { Check, ErrorNote, Note, Select, Slider, Spinner } from './controls';

/**
 * Choose a backdrop photo for each scene.
 *
 * Two ways to get one, sharing a single picker because the video cannot tell
 * them apart: a free photo from Pexels or NASA, or an image drawn on the spot by
 * ElevenLabs with the same key that speaks the script.
 *
 * Nothing is applied automatically. A stock library will happily return a beach
 * photo for "gravity", and dropping that behind a physics question would make
 * the video look worse, not better - so every image is one the creator picked.
 * That rule matters more, not less, for the generated ones: those cost credits.
 */

/** What a drawn image is credited as, in the caption and the publish kit. */
const AI_CREDIT = 'Generated with AI';

/** Scenes where a photo would collide with what is already on screen. */
const SKIP_KINDS = new Set(['options', 'countdown']);

interface SceneCandidates {
  [sceneIndex: number]: StockImage[];
}

export const StockPicker: React.FC<{
  content: QuizContent;
  setContent: (updater: (prev: QuizContent) => QuizContent) => void;
  pexelsKey: string;
  elevenKey: string;
  form: TopicForm;
  imageModels: { id: string; label: string }[];
  imageStyles: { id: string; label: string }[];
  googleImageModels: { id: string; label: string }[];
  geminiKey: string;
  orientation: string;
  showStock: boolean;
  stockOpacity: number;
  setStockOpacity: (v: number) => void;
}> = ({
  content, setContent, pexelsKey, elevenKey, form, imageModels, imageStyles,
  googleImageModels, geminiKey,
  orientation, showStock, stockOpacity, setStockOpacity,
}) => {
  const [candidates, setCandidates] = useState<SceneCandidates>({});
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [busyScene, setBusyScene] = useState<number | null>(null);
  const [drawingScene, setDrawingScene] = useState<number | null>(null);
  const [styleId, setStyleId] = useState('');
  const [modelId, setModelId] = useState('');
  const [provider, setProvider] = useState<'google' | 'elevenlabs'>('google');
  const [matchStyle, setMatchStyle] = useState(true);

  const google = provider === 'google';
  const models = google ? googleImageModels : imageModels;

  // The catalogues arrive from /api/health a moment after mount, so the first
  // entry is only knowable once they are here. The model is per provider, so a
  // name from the other one must not leak across.
  const style = styleId || (imageStyles[0]?.id ?? '');
  const model = models.some((m) => m.id === modelId) ? modelId : (models[0]?.id ?? '');
  const drawKey = (google ? geminiKey : elevenKey).trim();
  // Deliberately NOT gated on the model list. That list is a static catalogue
  // that happens to arrive from /api/health, and gating on it meant a helper
  // server running older code hid the entire feature with no explanation - the
  // tiles were there, and nothing else was. The server picks a sensible default
  // when no model is named, so a missing list costs a dropdown, not the button.
  const hasKey = drawKey.length > 5;
  const canGenerate = hasKey;
  const staleServer = hasKey && models.length === 0;

  /**
   * The first image drawn for this video, used to keep the rest in step.
   *
   * Only Google can do this - it takes a reference image in the same request -
   * and only the first one is used, deliberately: chaining each scene off the
   * one before it lets the look drift a little further every time.
   */
  const reference = React.useMemo(() => {
    if (!google || !matchStyle) return '';
    for (const line of content.script) {
      if (line.stockSrc && line.stockCredit === AI_CREDIT) return line.stockSrc;
    }
    for (const list of Object.values(candidates) as StockImage[][]) {
      const drawn = list.find((c) => c.provider === 'ai');
      if (drawn) return drawn.full;
    }
    return '';
  }, [google, matchStyle, content.script, candidates]);

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

    // Merge, so photos found now sit beside anything already drawn.
    setCandidates((prev) => {
      const next = { ...prev };
      for (const [key, list] of Object.entries(found)) {
        const drawn = (next[Number(key)] || []).filter((c) => c.provider === 'ai');
        next[Number(key)] = [...drawn, ...list];
      }
      return next;
    });
    setSearched(true);
    setSearching(false);
  };

  /**
   * Draw one backdrop for one scene.
   *
   * The result is added to that scene's candidates rather than applied, so it
   * can be compared against the stock options - and so pressing Generate twice
   * gives you two to choose between instead of silently discarding the first.
   */
  const generate = async (index: number, line: ScriptLine) => {
    const query = (line.imageQuery || '').trim() || fallbackQuery(line, content);
    if (!query) {
      setError('Type what this scene should show in its box above, then press Draw again.');
      return;
    }

    setDrawingScene(index);
    setError(null);
    try {
      const made = await api.generateImage({
        apiKey: drawKey,
        query,
        subject: content.subject || form.subject,
        topic: content.topic || form.topic,
        styleId: style,
        modelId: model,
        orientation,
        jobId,
        provider,
        referenceSrc: reference || undefined,
      });

      const drawn: StockImage = {
        id: made.id,
        provider: 'ai',
        // Already on disk: the browser reads it from public/, and the renderer
        // is handed the same relative path a stock photo would have given.
        thumb: '/' + made.src,
        full: made.src,
        credit: AI_CREDIT,
        sourceUrl: '',
        width: 0,
        height: 0,
        saved: true,
      };

      setCandidates((prev) => ({ ...prev, [index]: [drawn, ...(prev[index] || [])] }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDrawingScene(null);
    }
  };

  const choose = async (index: number, image: StockImage) => {
    setBusyScene(index);
    setError(null);
    try {
      // A generated image was written to disk when it was made; only a remote
      // one still has to be fetched.
      const src = image.saved
        ? image.full
        : (await api.pickStock(image.full, image.id, jobId)).src;
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

      <div className="tiles" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 4 }}>
        <button
          className={'tile' + (google ? ' active' : '')}
          onClick={() => setProvider('google')}
        >
          <div className="t">◆ Google</div>
          <div className="s">
            Uses your Gemini key. Needs billing on, not a subscription — about 3p an image.
          </div>
        </button>
        <button
          className={'tile' + (!google ? ' active' : '')}
          onClick={() => setProvider('elevenlabs')}
        >
          <div className="t">✳ ElevenLabs</div>
          <div className="s">
            Uses your ElevenLabs key. Needs a <b>Pro plan</b> — the free and Starter tiers cannot.
          </div>
        </button>
      </div>

      {!hasKey ? (
        <Note kind="info" title={'Add your ' + (google ? 'Gemini' : 'ElevenLabs') + ' key to draw'}>
          Drawing uses your <b>{google ? 'Gemini' : 'ElevenLabs'}</b> key, and there is not one saved
          yet. Paste it on <b>step 1</b> and the Draw buttons appear here by themselves.{' '}
          {google
            ? 'It is the same key that writes your script — writing stays free, drawing needs billing enabled on it.'
            : 'Drawing needs a Pro plan on that account; the free and Starter tiers cannot.'}
        </Note>
      ) : null}

      {staleServer ? (
        <Note kind="warn" title="Restart the helper to choose a model">
          Your helper server is running an older version of the tool, so it did not send the list of
          image models. Drawing still works — the server picks a sensible default — but the model
          dropdown is hidden until you stop it with <b>Ctrl + C</b> and run <b>npm start</b> again.
        </Note>
      ) : null}

      {canGenerate ? (
        <>
          <Note kind="warn" title={google ? 'Drawing costs a few pence a picture' : 'Drawing costs ElevenLabs credits'}>
            <b>Draw</b> asks for a new image, one scene at a time, in the exact shape you are
            rendering — so nothing is cropped the way a landscape stock photo has to be.{' '}
            {google
              ? 'Image generation is not on any Gemini free tier, so the key needs billing enabled; '
                + 'writing the script stays free either way.'
              : 'Each press spends credits from the same balance as the voiceover, and the API needs '
                + 'a Pro plan or above.'}{' '}
            Searching Pexels and NASA stays free.
          </Note>

          {google ? (
            <Check
              label="Keep every scene in the same style"
              hint={
                'The first image you draw becomes the reference for the rest, so one video looks '
                + 'like one set instead of twelve unrelated pictures. Costs nothing extra.'
                + (reference ? ' Matching to the first drawn image.' : ' Draw one to start it off.')
              }
              checked={matchStyle}
              onChange={setMatchStyle}
            />
          ) : null}

          <div className="grid">
            <Select
              label="Look of the drawn images"
              value={style}
              options={imageStyles}
              onChange={setStyleId}
              hint="Applied to every scene you draw, so one video looks like one set."
            />
            {models.length ? (
            <Select
              label="Image model"
              value={model}
              options={models}
              onChange={setModelId}
              hint={google
                ? 'Flash Lite is the cheapest and plenty for a backdrop. Flash matches a reference best.'
                : 'Flash models answer in seconds and cost least. Pro is slower and sharper.'}
            />
            ) : null}
          </div>
        </>
      ) : null}

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

      {Object.keys(candidates).length || canGenerate ? (
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
                  {canGenerate ? (
                    <button
                      className="btn small"
                      disabled={drawingScene !== null}
                      title="Generate a backdrop for this scene with ElevenLabs"
                      onClick={() => generate(index, line)}
                    >
                      {drawingScene === index ? <Spinner /> : '✏️'}{' '}
                      {options.some((o) => o.provider === 'ai') ? 'Draw another' : 'Draw'}
                    </button>
                  ) : null}
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
                        className={
                          'stock-thumb'
                          + (image.provider === 'ai' ? ' drawn' : '')
                          + (line.stockId === image.id ? ' active' : '')
                        }
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
                      ? searched
                        ? 'Nothing found. Try different search words above, then search again.'
                        : 'Search the free libraries, or draw one for this scene.'
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
