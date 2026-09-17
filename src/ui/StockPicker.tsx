import React, { useState } from 'react';
import { api, type StockImage, type TopicForm } from '../lib/api';
import type { QuizContent, ScriptLine } from '../lib/types';
import { draftImagePrompt } from '../lib/image-prompt';
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
 *
 * The one exception is "Draw and attach" for scenes no honest photo exists for:
 * the creator asks for it by name, on drawing prompts they could read first.
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
  /** The text model that writes drawing prompts for scenes with no honest photo. */
  geminiModel?: string;
  orientation: string;
  showStock: boolean;
  stockOpacity: number;
  setStockOpacity: (v: number) => void;
}> = ({
  content, setContent, pexelsKey, elevenKey, form, imageModels, imageStyles,
  googleImageModels, geminiKey, geminiModel = 'gemini-2.5-flash',
  orientation, showStock, stockOpacity, setStockOpacity,
}) => {
  const [candidates, setCandidates] = useState<SceneCandidates>({});
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [busyScene, setBusyScene] = useState<number | null>(null);
  const [drawingScene, setDrawingScene] = useState<number | null>(null);
  const [usedPrompt, setUsedPrompt] = useState<Record<number, string>>({});
  const [openPrompt, setOpenPrompt] = useState<number | null>(null);
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

  // Scenes Gemini judged no honest photo exists for. A drawing is not bound by
  // what a camera can capture, so these are the ones worth a drawing prompt.
  const noPhoto = eligible.filter(({ line }) => !(line.imageQuery || '').trim());
  const noPhotoIndexes = new Set(noPhoto.map(({ index }) => index));
  const canWrite = geminiKey.trim().length > 5;
  const needPrompt = noPhoto.filter(({ line }) => !(line.imagePrompt || '').trim());
  const readyToDraw = noPhoto.filter(({ line }) => (line.imagePrompt || '').trim() && !line.stockSrc);
  const [writing, setWriting] = useState<'all' | number | null>(null);
  const [promptNotes, setPromptNotes] = useState<string[]>([]);
  const [drawAll, setDrawAll] = useState<{ done: number; total: number } | null>(null);
  const batchBusy = writing !== null || drawAll !== null;

  /** Ask Gemini for drawing prompts for these scenes, and put them in each scene's prompt box. */
  const writePrompts = async (scenes: number[], which: 'all' | number) => {
    setWriting(which);
    setError(null);
    try {
      const out = await api.scenePrompts({ apiKey: geminiKey.trim(), model: geminiModel, content, scenes });
      setPromptNotes(out.notes);
      setContent((prev) => ({
        ...prev,
        script: prev.script.map((line, i) => (out.prompts[i] ? { ...line, imagePrompt: out.prompts[i] } : line)),
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setWriting(null);
    }
  };

  /**
   * Draw every no-photo scene that has a prompt and no image yet, and attach
   * each to its scene. The one place anything is applied for you - and only
   * because you pressed a button that says so, on prompts you could read first.
   */
  const drawAndAttachAll = async () => {
    const queue = readyToDraw.map(({ index }) => index);
    setDrawAll({ done: 0, total: queue.length });
    setError(null);
    // The reference is read from state, which does not update mid-loop - so the
    // first picture drawn here is carried along by hand to keep the rest in step.
    let styleReference = reference;
    for (let k = 0; k < queue.length; k++) {
      const index = queue[k];
      const drawn = await generate(index, content.script[index], styleReference);
      if (!drawn) break;
      if (!styleReference) styleReference = drawn.full;
      await choose(index, drawn);
      setDrawAll({ done: k + 1, total: queue.length });
    }
    setDrawAll(null);
  };

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
  const generate = async (index: number, line: ScriptLine, styleReference = reference): Promise<StockImage | null> => {
    const query = (line.imageQuery || '').trim() || fallbackQuery(line, content);
    const written = (line.imagePrompt || '').trim();
    // A written prompt is enough on its own: it is how a scene with no photo gets drawn.
    if (!query && !written) {
      setError('Write what this scene should show - press "Write a drawing prompt" - then press Draw again.');
      return null;
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
        referenceSrc: (google && matchStyle && styleReference) || undefined,
        imagePrompt: written || undefined,
      });

      // Keep what was actually sent, so it can be shown and refined rather
      // than guessed at.
      setUsedPrompt((prev) => ({ ...prev, [index]: made.prompt }));

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
      return drawn;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
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

  const setPrompt = (index: number, value: string) => {
    setContent((prev) => ({
      ...prev,
      script: prev.script.map((line, i) => (i === index ? { ...line, imagePrompt: value } : line)),
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

      <Note kind="info" title="You choose what goes in">
        A photo library will cheerfully return a beach for "gravity". Search, then pick only the
        images that genuinely fit — an unrelated backdrop makes a science video look worse, not better.
        Scenes you skip simply keep the plain background. The one exception is <b>Draw and attach</b>{' '}
        below, which attaches what it draws because that is what the button says.
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

      {noPhoto.length ? (
        <div className="no-photo-panel">
          <div className="no-photo-head">
            <b>
              ✨ {noPhoto.length} {noPhoto.length === 1 ? 'scene has' : 'scenes have'} no honest photo — draw{' '}
              {noPhoto.length === 1 ? 'it' : 'them'} instead
            </b>
            <span>
              Gemini writes a drawing prompt for each from what the scene says - a process made visible,
              an apparatus, a clear metaphor. Read or edit them in each scene below, then draw and attach
              them in one go. Nothing drawn before the answer scene shows the answer.
            </span>
          </div>
          <div className="actions" style={{ marginTop: 0 }}>
            <button
              className="btn primary"
              disabled={!canWrite || batchBusy}
              onClick={() => writePrompts((needPrompt.length ? needPrompt : noPhoto).map(({ index }) => index), 'all')}
            >
              {writing === 'all' ? <Spinner /> : '✨'}{' '}
              {needPrompt.length
                ? 'Write drawing prompts for ' + needPrompt.length + (needPrompt.length === 1 ? ' scene' : ' scenes')
                : 'Rewrite all ' + noPhoto.length + ' prompts'}
            </button>
            {canGenerate && readyToDraw.length ? (
              <button className="btn" disabled={batchBusy || drawingScene !== null} onClick={drawAndAttachAll}>
                {drawAll ? <Spinner /> : '🎨'} Draw and attach {readyToDraw.length}{' '}
                {readyToDraw.length === 1 ? 'image' : 'images'}
              </button>
            ) : null}
          </div>
          {!canWrite ? (
            <Note kind="info">Add a Gemini key on step 1 to write drawing prompts. Writing them is free-tier.</Note>
          ) : null}
          {canWrite && readyToDraw.length && !canGenerate ? (
            <Note kind="info">
              The prompts are written. Add your {google ? 'Gemini' : 'ElevenLabs'} key above to draw them.
            </Note>
          ) : null}
          {readyToDraw.length && canGenerate && !drawAll ? (
            <div className="hint" style={{ fontSize: 12.5, color: 'var(--dim)' }}>
              {readyToDraw.length} new {readyToDraw.length === 1 ? 'image' : 'images'} at the chosen model's price
              {google ? ' (billing must be on for the Gemini key)' : ' (ElevenLabs credits)'}.
            </div>
          ) : null}
          {drawAll ? (
            <>
              <div className="bar">
                <div style={{ width: ((drawAll.done + 0.3) / drawAll.total) * 100 + '%' }} />
              </div>
              <div className="progress-line">
                <span>Drawing and attaching…</span>
                <span>{drawAll.done} / {drawAll.total}</span>
              </div>
            </>
          ) : null}
          {promptNotes.map((n) => (
            <Note key={n} kind="warn">{n}</Note>
          ))}
        </div>
      ) : null}

      {Object.keys(candidates).length || canGenerate || noPhoto.length ? (
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
                  {canGenerate ? (
                    <button
                      className="link-btn"
                      title="Write exactly what this scene should show"
                      onClick={() => setOpenPrompt(openPrompt === index ? null : index)}
                    >
                      {openPrompt === index ? 'hide prompt' : line.imagePrompt ? 'prompt ✎' : 'prompt'}
                    </button>
                  ) : null}
                  {line.stockSrc ? (
                    <button className="link-btn" onClick={() => clear(index)}>
                      remove
                    </button>
                  ) : null}
                </div>

                {canGenerate && openPrompt === index ? (
                  <div className="stock-prompt">
                    <label>What to draw for this scene</label>
                    <textarea
                      rows={3}
                      value={line.imagePrompt || ''}
                      placeholder={
                        'Left empty, the search words above are used — which are written for a '
                        + 'photo search and make a thin prompt. Describe the picture instead.'
                      }
                      onChange={(e) => setPrompt(index, e.target.value)}
                    />
                    <div className="stock-prompt-row">
                      <button
                        className="link-btn"
                        onClick={() => setPrompt(index, draftImagePrompt(line, content))}
                      >
                        draft one from the narration
                      </button>
                      {line.imagePrompt ? (
                        <button className="link-btn" onClick={() => setPrompt(index, '')}>
                          clear
                        </button>
                      ) : null}
                    </div>
                    {usedPrompt[index] ? (
                      <div className="stock-prompt-used">
                        <b>Last sent:</b> {usedPrompt[index]}
                      </div>
                    ) : null}
                  </div>
                ) : null}

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
                ) : noPhotoIndexes.has(index) ? (
                  <div className="stock-empty">
                    {line.imagePrompt ? (
                      <>
                        <div className="no-photo-prompt">
                          <b>Drawing prompt:</b> {line.imagePrompt}
                        </div>
                        <div className="stock-prompt-row">
                          {canGenerate ? <span>Press <b>Draw</b> above, or draw them all at once.</span> : null}
                          {canGenerate ? (
                            <button className="link-btn" onClick={() => setOpenPrompt(index)}>edit</button>
                          ) : null}
                          <button
                            className="link-btn"
                            disabled={!canWrite || batchBusy}
                            onClick={() => writePrompts([index], index)}
                          >
                            {writing === index ? 'rewriting…' : 'rewrite with Gemini'}
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        No honest photo exists for this scene, so draw one instead.{' '}
                        <button
                          className="link-btn"
                          disabled={!canWrite || batchBusy}
                          onClick={() => writePrompts([index], index)}
                        >
                          {writing === index ? 'writing…' : '✨ Write a drawing prompt'}
                        </button>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="stock-empty">
                    {searched
                      ? 'Nothing found. Try different search words above, then search again.'
                      : 'Search the free libraries, or draw one for this scene.'}
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
