// ---------------------------------------------------------------------------
// The Animate editor for one scene.
//
// Everything is placed by pointing:
//   - WHEN: click a word in the narration strip. Shots cut, and callouts pop,
//     on the word they are pinned to - and follow it if the line is re-recorded.
//   - WHERE: click on the picture. Sets the camera's focus, a callout's spot
//     (Shift+click: an arrow's tail; routes add a waypoint per click), or where
//     a character stands.
// ---------------------------------------------------------------------------

import React, { useMemo, useState } from 'react';
import { defaultCallout } from '../lib/callouts';
import { narrationWords, newShot } from '../lib/script';
import { composePrompt, shotLabel } from '../lib/styles';
import { templateMotionPrompt } from '../lib/flow';
import { api, fileToBase64, mediaUrl } from '../lib/api';
import {
  blankGraphic, CALLOUT_KINDS, ELEMENT_KINDS, LAYER_MOTIONS, MOTIONS, type AnimElement, type Callout, type CalloutKind, type Effect, type ElementKind,
  type LayerMotion, type Motion, type Scene, type Shot,
} from '../lib/types';
import { useStudio } from './context';
import { ErrorNote, Note, Spinner } from './controls';
import { ChatbotHelper } from './ChatbotHelper';
import { GraphicEditor } from './GraphicEditor';
import { StockPicker } from './StockPicker';
import type { ShotTools } from './shotTools';

type Mode = 'focus' | 'callout' | 'layer' | 'element' | 'horizon';

const ELEMENT_ICON: Record<ElementKind, string> = {
  smoke: '💨', steam: '♨️', fire: '🔥', glow: '🏮', birds: '🐦', clouds: '☁️',
  sunrays: '☀️', shimmer: '✨', ripples: '💧', leaves: '🍂', fireflies: '🌟', sand: '🏜️',
};
/** Kinds that travel somewhere, so a direction means something. */
const DIRECTED: ElementKind[] = ['birds', 'sand', 'leaves', 'smoke'];

let elementCounter = 0;
const newElementId = () => 'el' + Date.now().toString(36) + (elementCounter++).toString(36);

const NUMERIC: CalloutKind[] = ['counter', 'thermometer', 'timeline'];

export const SceneEditor: React.FC<{ scene: Scene; index: number; tools: ShotTools; onClose: () => void; openStock?: boolean }> = ({ scene, index, tools, onClose, openStock = false }) => {
  const { project, update, updateScene, updateShot, keys, models, prefs, setPrefs, seekScene } = useStudio();
  const [shotId, setShotId] = useState(scene.shots[0].id);
  const [calloutId, setCalloutId] = useState('');
  const [mode, setMode] = useState<Mode>('focus');
  const [newKind, setNewKind] = useState<CalloutKind>('label');
  const [elementId, setElementId] = useState('');
  const [newElement, setNewElement] = useState<ElementKind>('smoke');
  const [placing, setPlacing] = useState(false);
  const [stockOpen, setStockOpen] = useState(openStock);
  const [who, setWho] = useState('');
  const [seconds, setSeconds] = useState(6);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const words = useMemo(() => narrationWords(scene.narration), [scene.narration]);
  const shotIndex = Math.max(0, scene.shots.findIndex((s) => s.id === shotId));
  const shot: Shot = scene.shots[shotIndex] || scene.shots[0];
  const callout = scene.callouts.find((c) => c.id === calloutId) || null;
  const busy = tools.busy[shot.id];

  const setCallout = (id: string, patch: Partial<Callout>) =>
    updateScene(scene.id, (s) => ({ callouts: s.callouts.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));

  const run = (p: Promise<unknown>) => {
    setError(null);
    p.catch((e) => setError((e as Error).message));
  };

  // --- pointing ------------------------------------------------------------------

  const clickWord = (w: number) => {
    if (callout) setCallout(callout.id, { atWord: w });
    else if (shotIndex > 0) updateShot(shot.id, { atWord: w });
  };

  const clickPicture = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    const y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
    const pt = { x: +x.toFixed(3), y: +y.toFixed(3) };
    if (mode === 'focus') updateShot(shot.id, { focus: pt });
    else if (mode === 'layer' && shot.layer) updateShot(shot.id, { layer: { ...shot.layer, x: pt.x, y: pt.y } });
    else if (mode === 'element' && elementId) setElement(elementId, { x: pt.x, y: pt.y });
    else if (mode === 'horizon') updateShot(shot.id, { depth: pt.y });
    else if (mode === 'callout' && callout) {
      if (callout.kind === 'route') setCallout(callout.id, { points: [...(callout.points || []), pt], x: pt.x, y: pt.y });
      else if (callout.kind === 'arrow' && e.shiftKey) setCallout(callout.id, { x2: pt.x, y2: pt.y });
      else setCallout(callout.id, { x: pt.x, y: pt.y });
    }
  };

  // --- shots -----------------------------------------------------------------------

  const addShot = () => {
    const lastAt = scene.shots.length > 1 ? scene.shots[scene.shots.length - 1].atWord : 0;
    const at = Math.min(words.length - 1, Math.max(lastAt + 3, Math.round((lastAt + words.length) / 2)));
    const s = newShot({ atWord: Math.max(1, at) });
    updateScene(scene.id, (sc) => ({ shots: [...sc.shots, s] }));
    setShotId(s.id);
    setCalloutId('');
  };
  const removeShot = () => {
    if (scene.shots.length < 2) return;
    updateScene(scene.id, (sc) => ({ shots: sc.shots.filter((s) => s.id !== shot.id) }));
    setShotId(scene.shots[0].id);
  };

  // --- callouts ----------------------------------------------------------------------

  const addCallout = () => {
    const at = callout ? callout.atWord : shotIndex > 0 ? shot.atWord : 0;
    const c = defaultCallout(newKind, at);
    updateScene(scene.id, (s) => ({ callouts: [...s.callouts, c] }));
    setCalloutId(c.id);
    setMode('callout');
  };

  // --- living picture: elements and depth --------------------------------------------------

  const elements = shot.elements || [];
  const setElement = (id: string, patch: Partial<AnimElement>) =>
    updateShot(shot.id, (s) => ({ elements: (s.elements || []).map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
  const addElement = () => {
    const kind = ELEMENT_KINDS.find((k) => k.id === newElement) || ELEMENT_KINDS[0];
    const e: AnimElement = { id: newElementId(), kind: kind.id, x: 0.5, y: kind.id === 'birds' || kind.id === 'clouds' ? 0.18 : 0.5, size: kind.size, intensity: 0.9, angle: kind.angle };
    updateShot(shot.id, (s) => ({ elements: [...(s.elements || []), e] }));
    setElementId(e.id);
    setCalloutId('');
    setMode('element');
  };

  /** Apply what the AI saw in the picture: elements, a horizon for depth, an atmosphere. */
  const applyElements = (r: { elements: Omit<AnimElement, 'id'>[]; depth: number | null; effect: string }) => {
    const next = r.elements.map((e) => ({ id: newElementId(), kind: e.kind, x: e.x, y: e.y, size: e.size, intensity: e.intensity, angle: e.angle }));
    updateShot(shot.id, (s) => ({ elements: [...(s.elements || []), ...next], depth: s.depth ?? r.depth }));
    if (scene.effect === 'none' && r.effect && r.effect !== 'none') updateScene(scene.id, { effect: r.effect as Effect });
    setNote(next.length
      ? 'Added ' + next.length + ' element' + (next.length === 1 ? '' : 's') + (r.depth !== null ? ' and depth' : '') + '. Click a marker to adjust it.'
      : 'Nothing in this picture asked for an element.' + (r.depth !== null ? ' Depth parallax was set.' : ''));
    setMode('element');
  };

  const autoPlace = () => {
    if (!shot.image) return setError('Draw or upload the picture first.');
    setPlacing(true);
    run(api.suggestElements({
      provider: prefs.writer,
      model: prefs.writer === 'claude' ? prefs.claudeModel : prefs.geminiModel,
      ...elementsBody(),
    }).then(applyElements).finally(() => setPlacing(false)));
  };
  const elementsBody = () => ({ image: shot.image, picture: shot.imagePrompt, narration: scene.narration });

  // --- picture overlay markers ----------------------------------------------------------

  const pct = (v: number | undefined) => (v ?? 0) * 100 + '%';
  const focus = shot.focus || { x: 0.5, y: 0.5 };
  const shotCallouts = scene.callouts;

  return (
    <div className="editor">
      <div className="editor-head">
        <b>Animate scene {index + 1}</b>
        <input
          className="chapter-input"
          value={scene.chapter}
          placeholder="Chapter title starting here? e.g. Secret #1: The walls"
          onChange={(e) => updateScene(scene.id, { chapter: e.target.value })}
        />
        <button className="btn small" onClick={() => seekScene(index)}>▶ Preview</button>
        <button className="btn small ghost" onClick={onClose}>Done</button>
      </div>

      <div className="shot-tabs">
        {scene.shots.map((s, k) => (
          <button key={s.id} className={'shot-tab' + (s.id === shot.id ? ' on' : '')} onClick={() => { setShotId(s.id); setCalloutId(''); setMode('focus'); }}>
            {s.image ? <img src={mediaUrl(s.image)} alt="" /> : <span className="empty">no picture</span>}
            <span className="lbl">{shotLabel(index, k)}{s.video ? ' 🎞' : ''}{s.layer ? ' 🧍' : ''}</span>
          </button>
        ))}
        <button className="shot-tab add" onClick={addShot} title="Add a shot that cuts in on a word">＋ Shot</button>
      </div>

      <div className="editor-grid">
        <div>
          <div className="modes">
            <span className="stat">Click the picture to set:</span>
            <button className={'btn small' + (mode === 'focus' ? ' primary' : '')} onClick={() => setMode('focus')}>🎯 Camera focus</button>
            <button className={'btn small' + (mode === 'layer' ? ' primary' : '')} disabled={!shot.layer} onClick={() => setMode('layer')}>🧍 Character spot</button>
            <button className={'btn small' + (mode === 'callout' ? ' primary' : '')} disabled={!callout} onClick={() => setMode('callout')}>📍 Callout spot</button>
            <button className={'btn small' + (mode === 'element' ? ' primary' : '')} disabled={!elementId} onClick={() => setMode('element')}>💨 Element spot</button>
            <button className={'btn small' + (mode === 'horizon' ? ' primary' : '')} disabled={shot.depth === null || shot.depth === undefined} onClick={() => setMode('horizon')}>〰 Horizon</button>
          </div>
          <div className="canvas" onClick={clickPicture}>
            {shot.graphic ? <div className="empty">📊 {shot.graphic.kind} graphic — see it in the preview on the right</div>
              : shot.video ? <video src={mediaUrl(shot.video)} muted loop autoPlay /> : shot.image ? <img src={mediaUrl(shot.image)} alt="" draggable={false} /> : <div className="empty">No picture for this shot yet</div>}
            {shot.layer && shot.layer.image ? (
              <img
                className="ghost-layer"
                src={mediaUrl(shot.layer.image)}
                alt=""
                draggable={false}
                style={{ left: pct(shot.layer.x), top: pct(shot.layer.y), height: shot.layer.scale * 100 + '%', transform: `translate(-50%, -100%) scaleX(${shot.layer.flip ? -1 : 1})` }}
              />
            ) : null}
            <div className="mark focus" style={{ left: pct(focus.x), top: pct(focus.y) }} title="Camera focus">＋</div>
            {typeof shot.depth === 'number' ? <div className="horizon" style={{ top: pct(shot.depth) }}><span>horizon</span></div> : null}
            {elements.map((el) => (
              <div
                key={el.id}
                className={'mark element' + (el.id === elementId ? ' on' : '')}
                style={{ left: pct(el.x), top: pct(el.y), width: Math.max(26, el.size * 100) + '%' }}
                onClick={(ev) => { ev.stopPropagation(); setElementId(el.id); setCalloutId(''); setMode('element'); }}
                title={el.kind}
              >
                <span>{ELEMENT_ICON[el.kind]}</span>
              </div>
            ))}
            {shotCallouts.map((c, k) => (
              <React.Fragment key={c.id}>
                {c.kind === 'route' && c.points && c.points.length > 1 ? (
                  <svg className="route" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <polyline points={c.points.map((p) => p.x * 100 + ',' + p.y * 100).join(' ')} fill="none" stroke="#e8483a" strokeWidth="0.6" />
                  </svg>
                ) : null}
                {c.kind === 'arrow' ? (
                  <svg className="route" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <line x1={(c.x2 ?? 0) * 100} y1={(c.y2 ?? 0) * 100} x2={c.x * 100} y2={c.y * 100} stroke="#fff6dc" strokeWidth="0.5" />
                  </svg>
                ) : null}
                <div
                  className={'mark callout' + (c.id === calloutId ? ' on' : '')}
                  style={{ left: pct(c.x), top: pct(c.y) }}
                  onClick={(e) => { e.stopPropagation(); setCalloutId(c.id); setMode('callout'); }}
                  title={c.kind + ': ' + c.text}
                >
                  {k + 1}
                </div>
              </React.Fragment>
            ))}
          </div>
          <p className="stat" style={{ marginTop: 6 }}>
            {mode === 'focus' ? 'The camera drifts towards this point (and a vertical Short crops around it).'
              : mode === 'layer' ? 'Click where the character’s feet should be.'
                : callout?.kind === 'route' ? 'Each click adds a waypoint to the route.'
                  : callout?.kind === 'arrow' ? 'Click = arrow tip. Shift+click = where the arrow starts (and its label sits).'
                    : mode === 'element' ? 'Click where this element goes: smoke and steam at the top of their source, rays at the light.'
                      : mode === 'horizon' ? 'Click on the horizon line. Below it slides more than above it as the camera moves.'
                        : 'Click where this callout goes.'}
          </p>

          <div className="lbl">Living picture — animated elements</div>
          <div className="row" style={{ marginTop: 0 }}>
            <button className="btn small primary" disabled={placing || !shot.image || !(prefs.writer === 'claude' ? keys.claude : keys.gemini)} onClick={autoPlace}
              title="Gemini or Claude looks at the picture and places smoke, birds, glints... where they belong">
              {placing ? <><Spinner /> Looking at the picture…</> : '✨ Auto-place (AI looks at the picture)'}
            </button>
            <select value={newElement} onChange={(e) => setNewElement(e.target.value as ElementKind)}>
              {ELEMENT_KINDS.map((k) => <option key={k.id} value={k.id}>{ELEMENT_ICON[k.id]} {k.label}</option>)}
            </select>
            <button className="btn small" onClick={addElement}>＋ Add</button>
          </div>
          <p className="stat">{ELEMENT_KINDS.find((k) => k.id === newElement)?.hint}</p>
          {elements.map((el) => (
            <div key={el.id} className={'element-row' + (el.id === elementId ? ' on' : '')} onClick={() => { setElementId(el.id); setCalloutId(''); setMode('element'); }}>
              <span className="kind">{ELEMENT_ICON[el.kind]} {ELEMENT_KINDS.find((k) => k.id === el.kind)?.label}</span>
              <label className="stat">size <input type="range" min={0.02} max={0.9} step={0.01} value={el.size} onChange={(e) => setElement(el.id, { size: Number(e.target.value) })} /></label>
              <label className="stat">strength <input type="range" min={0.2} max={1.5} step={0.05} value={el.intensity} onChange={(e) => setElement(el.id, { intensity: Number(e.target.value) })} /></label>
              {DIRECTED.includes(el.kind) ? (
                <select value={Math.cos((el.angle * Math.PI) / 180) >= 0 ? 0 : 180} onChange={(e) => setElement(el.id, { angle: Number(e.target.value) })} onClick={(e) => e.stopPropagation()}>
                  <option value={0}>→ to the right</option>
                  <option value={180}>← to the left</option>
                </select>
              ) : null}
              <button className="icon-btn" title="Remove" onClick={(e) => { e.stopPropagation(); updateShot(shot.id, (s) => ({ elements: (s.elements || []).filter((x) => x.id !== el.id) })); if (elementId === el.id) setElementId(''); }}>✕</button>
            </div>
          ))}
          <div className="row">
            <label className="stat" title="The part of the picture below the horizon slides more than the sky as the camera moves. Best for open landscapes; objects crossing the horizon can show a soft seam.">
              <input type="checkbox" checked={typeof shot.depth === 'number'} disabled={Boolean(shot.video)}
                onChange={(e) => { updateShot(shot.id, { depth: e.target.checked ? 0.58 : null }); if (e.target.checked) setMode('horizon'); }} />
              {' '}Depth parallax (best for open landscapes)
            </label>
          </div>
          {shot.image ? (
            <ChatbotHelper<{ elements: Omit<AnimElement, 'id'>[]; depth: number | null; effect: string }>
              task="elements"
              body={elementsBody}
              picture={shot.image}
              label="Place elements with any chatbot (attach the picture)"
              onResult={applyElements}
            />
          ) : null}
        </div>

        <div className="editor-side">
          <div className="seg small-seg">
            <button className={!shot.graphic ? 'on' : ''} onClick={() => updateShot(shot.id, { graphic: null })}>🖼 Picture</button>
            <button className={shot.graphic ? 'on' : ''} onClick={() => { if (!shot.graphic) updateShot(shot.id, { graphic: blankGraphic(project.kind === 'news' ? 'headline' : 'number') }); seekScene(index); }}>📊 Graphic</button>
          </div>
          {shot.graphic ? (
            <>
              <div className="lbl">Shot {shotLabel(index, shotIndex)} — graphic</div>
              <GraphicEditor g={shot.graphic} onChange={(g) => updateShot(shot.id, { graphic: g })} />
            </>
          ) : null}
          {project.kind === 'news' && project.sources.length ? (
            <>
              <div className="lbl">Sources for this scene</div>
              <div className="row" style={{ marginTop: 0 }}>
                {project.sources.map((src, k) => {
                  const on = (scene.sources || []).includes(k);
                  return (
                    <button key={k} className={'chip' + (on ? ' on' : '')} title={src.title}
                      onClick={() => updateScene(scene.id, (sc) => ({ sources: on ? (sc.sources || []).filter((x) => x !== k) : [...(sc.sources || []), k].sort((a, b) => a - b) }))}>
                      {k + 1}. {src.publisher || src.title.slice(0, 24)}
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}
          <div style={{ display: shot.graphic ? 'none' : undefined }}>
          <div className="lbl">Shot {shotLabel(index, shotIndex)} — picture</div>
          <textarea className="prompt" value={shot.imagePrompt} placeholder="Who is in the frame, doing what, where."
            onChange={(e) => updateShot(shot.id, { imagePrompt: e.target.value })} />
          <div className="row">
            <button className="btn small primary" disabled={Boolean(busy) || !keys.gemini} onClick={() => run(tools.draw(shot.id))}>{shot.image ? '↻ Redraw' : '🎨 Draw'}</button>
            <label className="btn small" style={{ cursor: 'pointer' }}>
              Upload
              <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) run(tools.upload(shot.id, f)); e.target.value = ''; }} />
            </label>
            <button className={'btn small' + (stockOpen ? ' primary' : '')} onClick={() => setStockOpen((v) => !v)}>🔎 Stock photos & videos</button>
            <button className="btn small" onClick={() => navigator.clipboard.writeText(composePrompt(project, shot, scene.narration)).then(() => setNote('Prompt copied.'))}>Copy prompt</button>
            {shot.image ? <button className="btn small ghost" title="Match new pictures to this one" onClick={() => update((p) => ({ ...p, styleRefShotId: shot.id }))}>★ Style ref</button> : null}
            {busy ? <span className="stat"><Spinner /> {busy}</span> : null}
          </div>
          {shot.credit ? (
            <div className="row">
              <span className={'pill' + (shot.credit.required ? ' warn' : ' good')} title={shot.credit.pageUrl}>
                {shot.video ? '🎬' : '📷'} {shot.credit.author} · {shot.credit.source} · {shot.credit.license}{shot.credit.required ? ' · credit shown' : ''}
              </span>
              {shot.credit.pageUrl ? <a className="stat" href={shot.credit.pageUrl} target="_blank" rel="noreferrer">source page ↗</a> : null}
            </div>
          ) : null}
          {stockOpen ? <StockPicker key={shot.id} scene={scene} shot={shot} onDone={() => setNote('Added from stock. The credit is kept with the shot.')} /> : null}
          <div className="row">
            <select value={shot.motion} onChange={(e) => updateShot(shot.id, { motion: e.target.value as Motion })} title="Camera move">
              {MOTIONS.map((m) => <option key={m.id} value={m.id}>🎥 {m.label}</option>)}
            </select>
            {shotIndex > 0 ? (
              <>
                <span className="stat">cuts in on “<b>{words[shot.atWord] || '?'}</b>”</span>
                <button className="btn small ghost danger" onClick={removeShot}>Remove shot</button>
              </>
            ) : <span className="stat">opens the scene</span>}
          </div>

          </div>
          <div className="lbl">Character layer (2.5D)</div>
          {shot.layer ? (
            <div className="row">
              <select value={shot.layer.motion} onChange={(e) => updateShot(shot.id, { layer: { ...shot.layer!, motion: e.target.value as LayerMotion } })}>
                {LAYER_MOTIONS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
              <label className="stat">size <input type="range" min={0.2} max={1.1} step={0.02} value={shot.layer.scale} onChange={(e) => updateShot(shot.id, { layer: { ...shot.layer!, scale: Number(e.target.value) } })} /></label>
              <label className="stat"><input type="checkbox" checked={shot.layer.flip} onChange={(e) => updateShot(shot.id, { layer: { ...shot.layer!, flip: e.target.checked } })} /> flip</label>
              <button className="btn small ghost danger" onClick={() => updateShot(shot.id, { layer: null })}>Remove</button>
            </div>
          ) : null}
          <div className="row">
            <input className="text" value={who} placeholder={shot.layer?.prompt || 'Who? e.g. Neferu, waving'} onChange={(e) => setWho(e.target.value)} />
            <button className="btn small" disabled={Boolean(busy) || !keys.gemini} onClick={() => run(tools.drawLayer(shot.id, who || shot.layer?.prompt || '').then((removed) => {
              setMode('layer');
              setNote(removed < 0.15 ? 'The background did not come out green, so little was cut away - try Draw again.' : 'Character cut out. Click the picture to place their feet.');
            }))}>🧍 Draw character</button>
            <label className="btn small" style={{ cursor: 'pointer' }} title="A PNG with transparency, or a picture on a green background">
              Upload
              <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) run(tools.uploadLayer(shot.id, f).then(() => setMode('layer'))); e.target.value = ''; }} />
            </label>
          </div>
          <p className="stat">Tip: draw the shot’s background without that person, then add them here — they float in front and move with depth.</p>

          <div className="lbl">Animated clip (Veo here, or Google Flow)</div>
          {shot.video ? (
            <div className="row">
              <span className="pill good">🎞 {shot.videoSeconds ? shot.videoSeconds.toFixed(0) + 's clip' : 'clip'} plays instead of the picture</span>
              <label className="stat"><input type="checkbox" checked={Boolean(shot.videoSound)} onChange={(e) => updateShot(shot.id, { videoSound: e.target.checked })} /> keep its sound</label>
              <button className="btn small ghost danger" onClick={() => updateShot(shot.id, { video: '', videoSeconds: 0 })}>Remove clip</button>
            </div>
          ) : null}
          <textarea className="prompt" value={shot.motionPrompt || ''} placeholder={templateMotionPrompt(scene, shot)}
            onChange={(e) => updateShot(shot.id, { motionPrompt: e.target.value })} />
          <div className="row">
            <button className="btn small" onClick={() => navigator.clipboard.writeText(shot.motionPrompt || templateMotionPrompt(scene, shot)).then(() => setNote('Motion prompt copied - paste it into Flow’s Frames to Video with this picture as the start frame.'))}>Copy for Flow</button>
            {shot.image ? <a className="btn small ghost" href={mediaUrl(shot.image)} download={shotLabel(index, shotIndex).replace(/^(\d+)/, (n) => n.padStart(2, '0')) + '.jpg'}>Save start frame</a> : null}
            <label className="btn small ghost" style={{ cursor: 'pointer' }}>
              Upload clip
              <input type="file" accept="video/mp4,video/webm" hidden onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) run(fileToBase64(f).then((dataBase64) => api.uploadClip({ projectId: project.id, shotId: shot.id, fileName: f.name, dataBase64 }))
                  .then((r) => updateShot(shot.id, { video: r.src, videoSeconds: r.seconds })));
                e.target.value = '';
              }} />
            </label>
          </div>
          <div className="row">
            <select value={prefs.videoModel} onChange={(e) => setPrefs((p) => ({ ...p, videoModel: e.target.value }))}>
              {(models.video.length ? models.video : [{ id: prefs.videoModel, label: prefs.videoModel }]).map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
            <select value={seconds} onChange={(e) => setSeconds(Number(e.target.value))}>
              {[4, 6, 8].map((n) => <option key={n} value={n}>{n}s</option>)}
            </select>
            <button className="btn small" disabled={Boolean(busy) || !keys.gemini || !shot.image} onClick={() => {
              if (!window.confirm('Animate this picture with ' + prefs.videoModel + '? Veo is billed per second of video on your Gemini key - check Google’s pricing page. Usually $1–3 for a clip.')) return;
              run(tools.animate(shot.id, shot.motionPrompt || templateMotionPrompt(scene, shot), seconds));
            }}>🎞 Animate</button>
          </div>
        </div>
      </div>

      <div className="lbl" style={{ marginTop: 14 }}>
        When — click a word {callout ? <>to move callout <b>{scene.callouts.indexOf(callout) + 1}</b></> : shotIndex > 0 ? <>to move the cut to shot <b>{shotLabel(index, shotIndex)}</b></> : '(select a shot or callout first)'}
      </div>
      <div className="words">
        {words.map((w, k) => {
          const cuts = scene.shots.map((s, i) => ({ s, i })).filter(({ s, i }) => i > 0 && s.atWord === k);
          const pops = scene.callouts.map((c, i) => ({ c, i })).filter(({ c }) => c.atWord === k);
          const active = (callout && callout.atWord === k) || (!callout && shotIndex > 0 && shot.atWord === k);
          return (
            <button key={k} className={'word' + (active ? ' on' : '')} onClick={() => clickWord(k)}>
              {cuts.map(({ i }) => <span key={'c' + i} className="cut">✂{shotLabel(index, i)}</span>)}
              {pops.map(({ i }) => <span key={'p' + i} className="pop">{i + 1}</span>)}
              {w}
            </button>
          );
        })}
      </div>

      <div className="lbl" style={{ marginTop: 14 }}>Callouts</div>
      {scene.callouts.map((c, k) => (
        <div key={c.id} className={'callout-row' + (c.id === calloutId ? ' on' : '')} onClick={() => { setCalloutId(c.id); setMode('callout'); }}>
          <span className="num">{k + 1}</span>
          <span className="kind">{CALLOUT_KINDS.find((x) => x.id === c.kind)?.label}</span>
          <input className="text" value={c.text} placeholder={c.kind === 'timeline' ? 'Label (optional)' : 'Text'} onChange={(e) => setCallout(c.id, { text: e.target.value })} />
          {NUMERIC.includes(c.kind) ? (
            <>
              {c.kind === 'timeline' ? (
                <>
                  <NumberBox label="from" value={c.from} onChange={(v) => setCallout(c.id, { from: v })} />
                  <NumberBox label="to" value={c.to} onChange={(v) => setCallout(c.id, { to: v })} />
                  <NumberBox label="here" value={c.value} onChange={(v) => setCallout(c.id, { value: v })} />
                </>
              ) : (
                <>
                  <NumberBox label="from" value={c.from} onChange={(v) => setCallout(c.id, { from: v })} />
                  <NumberBox label="to" value={c.value} onChange={(v) => setCallout(c.id, { value: v })} />
                  <input className="unit" value={c.unit || ''} placeholder="unit" onChange={(e) => setCallout(c.id, { unit: e.target.value })} />
                </>
              )}
            </>
          ) : null}
          <span className="stat">on “{words[c.atWord] || '?'}”</span>
          {c.kind === 'route' ? <button className="btn small ghost" onClick={(e) => { e.stopPropagation(); setCallout(c.id, { points: [] }); }}>Clear route</button> : null}
          <button className="icon-btn" title="Delete" onClick={(e) => { e.stopPropagation(); updateScene(scene.id, (s) => ({ callouts: s.callouts.filter((x) => x.id !== c.id) })); if (calloutId === c.id) setCalloutId(''); }}>✕</button>
        </div>
      ))}
      <div className="row">
        <select value={newKind} onChange={(e) => setNewKind(e.target.value as CalloutKind)}>
          {CALLOUT_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
        </select>
        <button className="btn small" onClick={addCallout}>＋ Add callout</button>
        <span className="stat">{CALLOUT_KINDS.find((k) => k.id === newKind)?.hint}. Years before Christ are negative: -1500 = 1500 BC.</span>
        {calloutId ? <button className="btn small ghost" onClick={() => setCalloutId('')}>Deselect callout</button> : null}
      </div>

      {note ? <Note kind="info">{note}</Note> : null}
      <ErrorNote error={error} />
    </div>
  );
};

const NumberBox: React.FC<{ label: string; value: number | undefined; onChange: (v: number) => void }> = ({ label, value, onChange }) => (
  <label className="numbox" onClick={(e) => e.stopPropagation()}>
    {label}
    <input type="number" value={value ?? ''} onChange={(e) => onChange(Number(e.target.value))} />
  </label>
);
