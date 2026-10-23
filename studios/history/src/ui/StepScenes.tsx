import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api, mediaUrl } from '../lib/api';
import { applySuggestions } from '../lib/callouts';
import { blankScene, isStale, narrationWords } from '../lib/script';
import { allPrompts, composePrompt, shotLabel, styleFor } from '../lib/styles';
import { spokenSeconds } from '../lib/timeline';
import { EFFECTS, GRAPHIC_KINDS, MOTIONS, TRANSITIONS, type Effect, type Motion, type Scene, type Transition } from '../lib/types';
import { useStudio } from './context';
import { needsPicture } from '../lib/news';
import { ErrorNote, Note, Spinner } from './controls';
import { FlowPanel } from './FlowPanel';
import { defaultQuery } from './StockPicker';
import { useStoredState } from '../lib/store';
import { ChatbotHelper } from './ChatbotHelper';
import type { CalloutSuggestions, StockCandidate, StoryboardResult, StoryResult } from '../lib/api';
import { applyStoryboard, batches, emptyShot, removeEmptyShots, storyboardBody, storyboardCount, storyboardPlan } from '../lib/storyboard';
import { holdStats } from '../lib/beats';
import { buildTimeline } from '../lib/timeline';
import { FPS } from '../lib/types';
import { SceneEditor } from './SceneEditor';
import { IMAGE_TYPES, styleReference, useShotTools } from './shotTools';
import { applyStory } from './StepStory';

export const StepScenes: React.FC = () => {
  const { project, update, updateScene, updateShot, keys, prefs, setPrefs, models, seekScene, goStep } = useStudio();
  const tools = useShotTools();
  const [batch, setBatch] = useState<{ done: number; total: number } | null>(null);
  const [thinking, setThinking] = useState<'' | 'plan' | 'callouts' | 'storyboard'>('');
  const [every, setEvery] = useStoredState<number>('storyboardEvery', 2);
  const [boardProgress, setBoardProgress] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState('');
  const [lightbox, setLightbox] = useState('');
  const [editing, setEditing] = useState('');
  const [flowOpen, setFlowOpen] = useState(false);
  const [stockFor, setStockFor] = useState('');
  const stopRef = useRef(false);
  const projectRef = useRef(project);
  projectRef.current = project;

  const model = models.image.find((m) => m.id === prefs.imageModel);
  const cents = model ? model.cents : 4;
  const allShots = project.scenes.flatMap((s) => s.shots);
  const missing = allShots.filter(needsPicture);
  const reference = styleReference(project);
  const writerKey = prefs.writer === 'claude' ? keys.claude : keys.gemini;
  const writerModel = prefs.writer === 'claude' ? prefs.claudeModel : prefs.geminiModel;

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(''), 1600);
    } catch {
      setError('The browser would not let the page use the clipboard.');
    }
  };

  const drawAll = async () => {
    const todo = projectRef.current.scenes.flatMap((s) => s.shots).filter(needsPicture).map((s) => s.id);
    if (!todo.length) return;
    if (!window.confirm('Draw ' + todo.length + ' pictures? About $' + ((todo.length * cents) / 100).toFixed(2) + ' on the Gemini key.')) return;
    stopRef.current = false;
    setError(null);
    setBatch({ done: 0, total: todo.length });
    try {
      // With nothing to match yet, the first picture is drawn alone and becomes the reference.
      if (!styleReference(projectRef.current)) {
        await tools.draw(todo.shift() as string, '');
        setBatch((b) => b && { ...b, done: b.done + 1 });
        await new Promise((r) => setTimeout(r, 80));
      }
      const ref = styleReference(projectRef.current)?.image || '';
      let failures = 0;
      const worker = async () => {
        while (todo.length && !stopRef.current) {
          const id = todo.shift() as string;
          try {
            await tools.draw(id, ref);
          } catch (e) {
            failures++;
            setError((e as Error).message);
            if (failures >= 3) stopRef.current = true;
          }
          setBatch((b) => b && { ...b, done: b.done + 1 });
        }
      };
      await Promise.all([worker(), worker()]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBatch(null);
    }
  };

  const [stockLibs] = useStoredState<string[]>('stockLibraries', ['pexels', 'pixabay', 'wikimedia', 'openverse']);

  /**
   * Every empty shot gets the best stock photo for its search - never the same
   * photo twice in one video. A starting point to review, not a final choice.
   */
  const fillFromStock = async () => {
    const todo = projectRef.current.scenes.flatMap((sc) => sc.shots.filter(needsPicture).map((sh) => ({ sc, sh })));
    if (!todo.length) return;
    if (!window.confirm('Fill ' + todo.length + ' empty shot' + (todo.length === 1 ? '' : 's') + ' with the best free stock photo for each? Review them afterwards — stock picked blind can miss.')) return;
    stopRef.current = false;
    setError(null);
    setBatch({ done: 0, total: todo.length });
    const used = new Set(projectRef.current.scenes.flatMap((sc) => sc.shots.map((sh) => sh.credit?.pageUrl).filter(Boolean)));
    let missed = 0;
    for (const { sc, sh } of todo) {
      if (stopRef.current) break;
      try {
        const q = defaultQuery(sh, sc.narration);
        const r = q ? await api.stockSearch({ query: q, type: 'photo', providers: stockLibs.length ? stockLibs : ['wikimedia', 'openverse'] }) : { results: [] as StockCandidate[], query: q };
        const pick = r.results.filter((c) => !used.has(c.credit.pageUrl)).sort((a, b) => Number(b.width >= 1600) - Number(a.width >= 1600))[0];
        if (!pick) { missed++; continue; }
        used.add(pick.credit.pageUrl);
        const got = await api.stockUse({ projectId: projectRef.current.id, shotId: sh.id, candidate: pick });
        updateShot(sh.id, { image: got.src, imageSource: 'upload', video: '', videoSeconds: 0, credit: got.credit, stockQuery: r.query || q });
      } catch (e) {
        missed++;
        setError((e as Error).message);
      } finally {
        setBatch((b) => b && { ...b, done: b.done + 1 });
      }
    }
    setBatch(null);
    if (missed) setError(missed + ' shot(s) found nothing usable — open 🔎 Stock on them and try other words.');
  };

  /** Many files at once: "scene-7.png" goes to scene 7, "scene-7b.png" to its second shot; the rest fill empty shots in order. */
  const uploadMany = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setError(null);
    const list = [...files].filter((f) => IMAGE_TYPES.test(f.name)).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    const scenes = projectRef.current.scenes;
    const taken = new Set<string>();
    const plan: [string, File][] = [];
    const loose: File[] = [];
    for (const f of list) {
      const m = f.name.match(/(\d+)([a-z])?(?=[^\d]*$)/i) || f.name.match(/(\d+)([a-z])?/i);
      const n = m ? Number(m[1]) : NaN;
      const k = m && m[2] ? m[2].toLowerCase().charCodeAt(0) - 97 : 0;
      const shot = Number.isInteger(n) && n >= 1 && n <= scenes.length ? scenes[n - 1].shots[k] : undefined;
      if (shot && !taken.has(shot.id)) {
        plan.push([shot.id, f]);
        taken.add(shot.id);
      } else loose.push(f);
    }
    for (const s of scenes.flatMap((x) => x.shots)) {
      if (!loose.length) break;
      if (needsPicture(s) && !taken.has(s.id)) {
        plan.push([s.id, loose.shift() as File]);
        taken.add(s.id);
      }
    }
    setBatch({ done: 0, total: plan.length });
    for (const [id, f] of plan) {
      await tools.upload(id, f).catch((e) => setError((e as Error).message));
      setBatch((b) => b && { ...b, done: b.done + 1 });
    }
    setBatch(null);
    if (loose.length) setError(loose.length + ' file(s) had nowhere to go - every shot already has a picture.');
  };

  const directBody = () => ({
    narrations: projectRef.current.scenes.map((s) => s.narration), title: project.title, language: project.language, styleName: styleFor(project.styleId).label,
  });
  const calloutBody = () => ({ narrations: projectRef.current.scenes.map((s) => s.narration), title: project.title });

  const planPictures = async () => {
    if (!writerKey) return setError('This needs a Gemini or Claude key.');
    if (project.scenes.some((s) => s.shots[0].imagePrompt.trim()) && !window.confirm('Replace the current picture descriptions with new ones?')) return;
    setThinking('plan');
    setError(null);
    try {
      const narrations = project.scenes.map((s) => s.narration);
      const r = await api.directScript({ provider: prefs.writer, model: writerModel, ...directBody() });
      update((p) => (p.scenes.length === narrations.length ? applyStory(p, r, narrations) : p));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setThinking('');
    }
  };

  const stats = useMemo(() => holdStats(buildTimeline(project).scenes, FPS), [project]);
  const emptyExtras = project.scenes.reduce((a, sc) => a + sc.shots.slice(1).filter(emptyShot).length, 0);
  const board = useMemo(() => storyboardCount(project, every), [project, every]);
  const styleName = () => styleFor(projectRef.current.styleId).label;
  const boardBody = () => storyboardBody(projectRef.current, storyboardPlan(projectRef.current, every), styleName());
  const boardDone = (added: number) => setNotice(added
    ? 'Planned ' + added + ' new picture' + (added === 1 ? '' : 's') + '. Next: 🎨 Draw missing, or 🔎 Fill empty from stock — then look through them.'
    : 'Every beat already has a picture.');
  const takeBoard = (r: StoryboardResult) => {
    const plan = storyboardPlan(projectRef.current, every);
    let added = 0;
    update((p) => { const out = applyStoryboard(p, plan, r); added = out.added; return out.project; });
    boardDone(added);
  };

  /** A picture for every couple of seconds of narration, planned a few scenes at a time. */
  const planStoryboard = async () => {
    if (!writerKey) return setError('This needs a Gemini or Claude key.');
    const parts = batches(storyboardPlan(projectRef.current, every));
    setThinking('storyboard');
    setError(null);
    setNotice('');
    let added = 0;
    try {
      for (let k = 0; k < parts.length; k++) {
        setBoardProgress(parts.length > 1 ? 'Planning part ' + (k + 1) + ' of ' + parts.length + '…' : 'Planning…');
        const r = await api.storyboard({ provider: prefs.writer, model: writerModel, ...storyboardBody(projectRef.current, parts[k], styleName()) });
        // Applied part by part, so each later part sees the style bible the first one wrote.
        const out = applyStoryboard(projectRef.current, parts[k], r);
        added += out.added;
        projectRef.current = out.project;
        update(() => out.project);
      }
      boardDone(added);
    } catch (e) {
      setError((e as Error).message + (added ? ' — the ' + added + ' pictures planned before this are kept; run it again to finish.' : ''));
    } finally {
      setThinking('');
      setBoardProgress('');
    }
  };

  const suggestCallouts = async () => {
    if (!writerKey) return setError('This needs a Gemini or Claude key.');
    setThinking('callouts');
    setError(null);
    try {
      const narrations = project.scenes.map((s) => s.narration);
      const r = await api.suggestCallouts({ provider: prefs.writer, model: writerModel, ...calloutBody() });
      update((p) => (p.scenes.length === narrations.length ? applySuggestions(p, r) : p));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setThinking('');
    }
  };

  const move = (i: number, d: number) => update((p) => {
    const scenes = [...p.scenes];
    const j = i + d;
    if (j < 0 || j >= scenes.length) return p;
    [scenes[i], scenes[j]] = [scenes[j], scenes[i]];
    return { ...p, scenes };
  });
  const insertAfter = (i: number) => update((p) => {
    const scenes = [...p.scenes];
    scenes.splice(i + 1, 0, blankScene(''));
    return { ...p, scenes };
  });
  const remove = (i: number) => {
    if (!window.confirm('Delete scene ' + (i + 1) + '?')) return;
    update((p) => ({ ...p, scenes: p.scenes.filter((_, k) => k !== i) }));
  };
  const mergeNext = (i: number) => update((p) => {
    if (i >= p.scenes.length - 1) return p;
    const a = p.scenes[i];
    const b = p.scenes[i + 1];
    const offset = narrationWords(a.narration).length;
    // The second scene's first shot becomes a cut, on its first word.
    const bShots = b.shots.map((s, k) => ({ ...s, atWord: (k === 0 ? 0 : s.atWord) + offset }));
    const merged: Scene = {
      ...a,
      narration: (a.narration + ' ' + b.narration).trim(),
      shots: [...a.shots, ...bShots.filter((s) => s.image || s.imagePrompt)],
      callouts: [...a.callouts, ...b.callouts.map((c) => ({ ...c, atWord: c.atWord + offset }))],
      audio: null,
    };
    return { ...p, scenes: [...p.scenes.slice(0, i), merged, ...p.scenes.slice(i + 2)] };
  });

  useEffect(() => () => { stopRef.current = true; }, []);

  return (
    <div className="panel">
      <h2>Scenes & pictures</h2>
      <p className="lede">
        Each scene is one stretch of narration. Give it a picture — then open <b>🎬 Animate</b> to add more shots that cut on a word,
        a floating character, an AI-animated clip, and callouts that pop in as the words are spoken.
      </p>

      <div className="toolbar">
        <span className="stat"><b>{allShots.length - missing.length}</b> / {allShots.length} pictures</span>
        <div className="spacer" />
        <select className="compact" value={prefs.imageModel} onChange={(e) => setPrefs((p) => ({ ...p, imageModel: e.target.value }))} title="Image model">
          {models.image.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
        {batch ? (
          <button className="btn small danger" onClick={() => { stopRef.current = true; }}><Spinner /> {batch.done}/{batch.total} — Stop</button>
        ) : (
          <button className="btn small primary" disabled={!missing.length || !keys.gemini} onClick={drawAll} title={keys.gemini ? '' : 'Needs a Gemini key with billing'}>
            🎨 Draw {missing.length} missing (~${((missing.length * cents) / 100).toFixed(2)})
          </button>
        )}
      </div>
      <div className="toolbar" style={{ marginTop: -6 }}>
        <button className="btn small" onClick={() => copy(allPrompts(project), 'all')}>{copied === 'all' ? 'Copied ✓' : '📋 Copy all prompts'}</button>
        <label className="btn small" style={{ cursor: 'pointer' }}>
          ⬆ Upload many pictures
          <input type="file" accept="image/*" multiple hidden onChange={(e) => { uploadMany(e.target.files); e.target.value = ''; }} />
        </label>
        <button className="btn small" disabled={Boolean(thinking) || !writerKey} onClick={planPictures}>
          {thinking === 'plan' ? <><Spinner /> Planning…</> : '✨ AI: describe every picture'}
        </button>
        <button className="btn small" disabled={Boolean(thinking) || !writerKey} onClick={suggestCallouts}>
          {thinking === 'callouts' ? <><Spinner /> Thinking…</> : '✨ AI: suggest callouts & chapters'}
        </button>
        <button className="btn small" disabled={Boolean(batch) || !missing.length} onClick={fillFromStock} title="Best free photo for each empty shot, from the libraries chosen in the stock picker">
          🔎 Fill {missing.length ? missing.length + ' ' : ''}empty from stock
        </button>
        <button className={'btn small' + (flowOpen ? ' primary' : '')} onClick={() => setFlowOpen((v) => !v)}>🎞 Animate in Google Flow</button>
        <div className="spacer" />
        {reference ? <span className="stat">Style reference ★ set</span> : null}
      </div>
      <div className="chat-row">
        <ChatbotHelper<StoryResult>
          task="direct"
          body={directBody}
          label="Describe every picture with any chatbot"
          onResult={(r) => update((p) => (p.scenes.length === r.scenes.length ? applyStory(p, r, p.scenes.map((s) => s.narration)) : p))}
        />
        <ChatbotHelper<CalloutSuggestions>
          task="callouts"
          body={calloutBody}
          label="Suggest callouts & chapters with any chatbot"
          onResult={(r) => update((p) => applySuggestions(p, r))}
        />
      </div>
      {flowOpen ? <FlowPanel /> : null}
      <p className="stat" style={{ margin: '0 0 14px' }}>
        Uploading many: <span className="kbd">scene-7.png</span> goes to scene 7, <span className="kbd">scene-7b.png</span> to its second shot; other files fill empty shots in order.
      </p>

      <div className="storyboard-bar">
        <div className="row" style={{ marginTop: 0 }}>
          <b>📽 Storyboard</b>
          <span className="stat">a new picture every</span>
          <select value={every} onChange={(e) => setEvery(Number(e.target.value))}>
            {[2, 3, 4, 6].map((n) => <option key={n} value={n}>{n} seconds</option>)}
          </select>
          <span className="stat">≈ <b>{board.total}</b> pictures{board.toDraw ? <> · {board.toDraw} to make (~${((board.toDraw * cents) / 100).toFixed(2)} to draw, or free from stock)</> : null}</span>
          <div className="spacer" />
          <button className="btn small primary" disabled={Boolean(thinking) || !writerKey} onClick={planStoryboard}
            title="Splits every scene at its phrases and writes one picture for each beat. Pictures already made are kept.">
            {thinking === 'storyboard' ? <><Spinner /> {boardProgress}</> : '✨ AI: storyboard every beat'}
          </button>
        </div>
        <p className="stat" style={{ margin: '6px 0 0' }}>
          Fast explainers change the drawing on almost every phrase. This cuts each scene at its commas and full stops, about every {every} seconds, and plans a picture for each beat. Pictures you already have stay.
        </p>
        <ChatbotHelper<StoryboardResult> task="storyboard" body={boardBody} label="Storyboard with any chatbot" onResult={takeBoard} />
      </div>
      <div className="toolbar pace-bar">
        <span className="stat">
          ⏱ Longest hold <b className={stats.longest > (project.design.pace || 4) * 1.5 ? 'warn' : ''}>{stats.longest.toFixed(1)}s</b>
          {stats.beats ? <> · {stats.beats} beats fill the gaps (pace: every {project.design.pace}s, change in <a onClick={() => goStep(4)}>Look</a>)</> : project.design.pace ? null : <> · beats are off (<a onClick={() => goStep(4)}>Look</a>)</>}
          {' '}· {allShots.length} shots in {project.scenes.length} scenes
        </span>
        <div className="spacer" />
        {emptyExtras ? (
          <button className="btn small" onClick={() => { let n = 0; update((p) => { const out = removeEmptyShots(p); n = out.removed; return out.project; }); setNotice('Removed ' + n + ' empty extra shot' + (n === 1 ? '' : 's') + '.'); }}
            title="Takes out the extra shots that still have no picture">
            ✕ Remove {emptyExtras} empty extra shot{emptyExtras === 1 ? '' : 's'}
          </button>
        ) : null}
      </div>
      {notice ? <Note kind="info">{notice}</Note> : null}
      <ErrorNote error={error} />
      {!keys.gemini ? (
        <Note kind="info">No Gemini key, so AI drawing and animation are off. Copy prompts into any image tool, then upload the pictures here.</Note>
      ) : null}

      {project.scenes.map((scene, i) => {
        const stale = isStale(scene);
        const first = scene.shots[0];
        const open = editing === scene.id;
        const extras = scene.shots.length - 1;
        return (
          <div key={scene.id} className={'scene' + (open ? ' current' : '')}>
            <div>
              <div
                className="pic"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) tools.upload(first.id, f).catch((x) => setError((x as Error).message)); }}
              >
                {first.graphic ? (
                  <span className="graphic-badge" onClick={() => { setEditing(scene.id); seekScene(i); }}>
                    📊 {GRAPHIC_KINDS.find((k) => k.id === first.graphic!.kind)?.label}<br /><small>{first.graphic.title || first.graphic.countries.join(', ') || first.graphic.who}</small>
                  </span>
                ) : first.image ? <img src={mediaUrl(first.image)} alt="" onClick={() => setLightbox(first.image)} /> : <span>Drop a picture here</span>}
                {tools.busy[first.id] ? <div className="busy"><Spinner /> {tools.busy[first.id]}</div> : null}
                <div className="badges">
                  {extras ? <span>+{extras} shot{extras > 1 ? 's' : ''}</span> : null}
                  {scene.shots.some((s) => s.layer) ? <span>🧍</span> : null}
                  {scene.shots.some((s) => s.video) ? <span>🎞</span> : null}
                  {scene.callouts.length ? <span>📍{scene.callouts.length}</span> : null}
                </div>
              </div>
              <div className="pic-actions">
                <button className="btn small primary" style={first.graphic ? { display: 'none' } : undefined} disabled={Boolean(tools.busy[first.id]) || !keys.gemini} onClick={() => tools.draw(first.id).catch((e) => setError((e as Error).message))}>
                  {first.image ? '↻ Redraw' : '🎨 Draw'}
                </button>
                <label className="btn small" style={{ cursor: 'pointer' }}>
                  Upload
                  <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) tools.upload(first.id, f).catch((x) => setError((x as Error).message)); e.target.value = ''; }} />
                </label>
                <button className="btn small" onClick={() => { setStockFor(scene.id); setEditing(scene.id); seekScene(i); }} title="Free photos and videos: Pexels, Pixabay, Wikimedia Commons, Openverse, NASA">🔎 Stock</button>
                <button className="btn small" onClick={() => copy(composePrompt(project, first, scene.narration), first.id)}>{copied === first.id ? 'Copied ✓' : 'Copy prompt'}</button>
              </div>
            </div>
            <div>
              <div className="head">
                <span className="num" onClick={() => seekScene(i)} title="Show in preview">#{i + 1}</span>
                <span className="meta">{scene.audio ? '' : '~'}{spokenSeconds(scene).toFixed(0)}s</span>
                {scene.audio ? (stale ? <span className="pill warn">voice out of date</span> : <span className="pill good">voiced</span>) : <span className="pill">no voice</span>}
                {scene.chapter ? <span className="pill chapter" title="Chapter">📖 {scene.chapter}</span> : null}
                <div className="spacer" />
                <button className="icon-btn" title="Move up" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                <button className="icon-btn" title="Move down" disabled={i === project.scenes.length - 1} onClick={() => move(i, 1)}>↓</button>
                <button className="icon-btn" title="Merge with the next scene" disabled={i === project.scenes.length - 1} onClick={() => mergeNext(i)}>⤓</button>
                <button className="icon-btn" title="Add a scene after this one" onClick={() => insertAfter(i)}>＋</button>
                <button className="icon-btn" title="Delete scene" onClick={() => remove(i)}>✕</button>
              </div>
              <textarea className="narr" value={scene.narration} placeholder="What the narrator says over this picture"
                onChange={(e) => updateScene(scene.id, { narration: e.target.value })} />
              <div className="lbl">Picture shows</div>
              <textarea className="prompt" value={first.imagePrompt} placeholder="Who is in the frame, doing what, where. Leave empty to draw straight from the narration."
                onChange={(e) => updateShot(first.id, { imagePrompt: e.target.value })} />
              <div className="row">
                <select value={first.motion} onChange={(e) => updateShot(first.id, { motion: e.target.value as Motion })} title="Camera move">
                  {MOTIONS.map((m) => <option key={m.id} value={m.id}>🎥 {m.label}</option>)}
                </select>
                <select value={scene.effect} onChange={(e) => updateScene(scene.id, { effect: e.target.value as Effect })} title="Atmosphere">
                  {EFFECTS.map((m) => <option key={m.id} value={m.id}>✨ {m.label}</option>)}
                </select>
                {i > 0 ? (
                  <select value={scene.transition} onChange={(e) => updateScene(scene.id, { transition: e.target.value as Transition })} title="How this scene arrives">
                    {TRANSITIONS.map((m) => <option key={m.id} value={m.id}>↪ {m.label}</option>)}
                  </select>
                ) : null}
                <button className={'btn small' + (open ? ' primary' : '')} onClick={() => { setEditing(open ? '' : scene.id); if (!open) seekScene(i); }}>
                  🎬 Animate{extras || scene.callouts.length ? ' (' + (extras ? extras + ' shot' + (extras > 1 ? 's' : '') : '') + (extras && scene.callouts.length ? ', ' : '') + (scene.callouts.length ? scene.callouts.length + ' callout' + (scene.callouts.length > 1 ? 's' : '') : '') + ')' : ''}
                </button>
              </div>
            </div>
            {open ? (
              <div style={{ gridColumn: '1 / -1' }}>
                <SceneEditor key={scene.id + (stockFor === scene.id ? '-stock' : '')} scene={scene} index={i} tools={tools} openStock={stockFor === scene.id} onClose={() => { setEditing(''); setStockFor(''); }} />
              </div>
            ) : null}
          </div>
        );
      })}

      <div className="actions">
        <button className="btn" onClick={() => insertAfter(project.scenes.length - 1)}>＋ Add scene</button>
        <div className="spacer" />
        <button className="btn primary" onClick={() => goStep(3)}>Next: voice →</button>
      </div>

      {lightbox ? <div className="lightbox" onClick={() => setLightbox('')}><img src={mediaUrl(lightbox)} alt="" /></div> : null}
    </div>
  );
};

export { shotLabel };
