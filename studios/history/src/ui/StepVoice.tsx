import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api, fileToBase64, mediaUrl, type Voice } from '../lib/api';
import { listMics, Recorder } from '../lib/recorder';
import { estimateWords, isStale } from '../lib/script';
import type { Scene, SceneAudio, VoiceSettings } from '../lib/types';
import { useStudio } from './context';
import { Check, ErrorNote, Note, Select, Slider, Spinner } from './controls';
import { ChatbotHelper } from './ChatbotHelper';
import { hasTags, splitTags, stripTags, supportsTags } from '../lib/speech';
import type { VoiceDirections } from '../lib/api';

/** One shared player for all the little ▶ buttons. */
const player = typeof Audio !== 'undefined' ? new Audio() : null;
const play = (src: string) => {
  if (!player) return;
  if (player.src.endsWith(src) && !player.paused) {
    player.pause();
    return;
  }
  player.src = src;
  player.currentTime = 0;
  player.play().catch(() => undefined);
};

export const StepVoice: React.FC = () => {
  const { project, update, keys } = useStudio();
  const mode = project.voice.mode;
  const setMode = (m: 'eleven' | 'mic') => update((p) => ({ ...p, voice: { ...p.voice, mode: m } }));

  return (
    <div className="panel">
      <h2>Voice</h2>
      <p className="lede">Use an ElevenLabs voice, or record the narration herself with the built-in teleprompter. She can mix both — re-record any single scene either way.</p>
      <div className="seg">
        <button className={mode === 'eleven' ? 'on' : ''} onClick={() => setMode('eleven')}>🤖 ElevenLabs voice</button>
        <button className={mode === 'mic' ? 'on' : ''} onClick={() => setMode('mic')}>🎙️ Record my own</button>
      </div>
      {mode === 'eleven' ? <ElevenPanel /> : <MicPanel />}
      {mode === 'mic' && !keys.eleven ? (
        <Note kind="info">
          Tip: with an ElevenLabs key on the Keys step, recordings get <b style={{ display: 'inline' }}>exact</b> word-by-word caption timing
          (it uses almost no credits). Without one, the timing is estimated — fine for phrase captions, a bit loose for the gold highlight.
        </Note>
      ) : null}
    </div>
  );
};

// ---------------------------------------------------------------------------
// ElevenLabs
// ---------------------------------------------------------------------------

const ElevenPanel: React.FC = () => {
  const { project, update, updateScene, keys, models } = useStudio();
  const v = project.voice;
  const setV = (patch: Partial<VoiceSettings>) => update((p) => ({ ...p, voice: { ...p.voice, ...patch } }));
  const [voices, setVoices] = useState<Voice[]>([]);
  const [quota, setQuota] = useState<{ used: number; limit: number } | null>(null);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [batch, setBatch] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stopRef = useRef(false);
  const projectRef = useRef(project);
  projectRef.current = project;

  useEffect(() => {
    if (!keys.eleven) return;
    api.voices().then((r) => setVoices(r.voices)).catch((e) => setError(e.message));
    api.quota().then((r) => setQuota(r.quota)).catch(() => undefined);
  }, [keys.eleven]);

  const todo = project.scenes.filter((s) => !s.audio || isStale(s));
  const chars = todo.reduce((n, s) => n + s.narration.length, 0);

  const voiceScene = async (id: string) => {
    const p = projectRef.current;
    const i = p.scenes.findIndex((s) => s.id === id);
    const scene = p.scenes[i];
    if (!scene || !scene.narration.trim()) return;
    setBusy((b) => ({ ...b, [id]: true }));
    try {
      const r = await api.speak({
        projectId: p.id,
        sceneId: id,
        text: scene.narration,
        previous: p.scenes[i - 1]?.narration || '',
        next: p.scenes[i + 1]?.narration || '',
        settings: p.voice,
      });
      const audio: SceneAudio = {
        src: r.src, duration: r.duration, source: 'eleven', timed: r.timed, text: scene.narration,
        words: r.timed ? r.words : estimateWords(scene.narration, 0.05, r.duration - 0.1),
      };
      updateScene(id, { audio });
    } finally {
      setBusy((b) => ({ ...b, [id]: false }));
    }
  };

  const voiceAll = async () => {
    const ids = projectRef.current.scenes.filter((s) => (!s.audio || isStale(s)) && s.narration.trim()).map((s) => s.id);
    if (!ids.length) return;
    stopRef.current = false;
    setError(null);
    setBatch({ done: 0, total: ids.length });
    let failures = 0;
    const worker = async () => {
      while (ids.length && !stopRef.current) {
        const id = ids.shift() as string;
        try {
          await voiceScene(id);
        } catch (e) {
          failures++;
          setError((e as Error).message);
          if (failures >= 2) stopRef.current = true;
        }
        setBatch((b) => b && { ...b, done: b.done + 1 });
      }
    };
    await Promise.all([worker(), worker()]);
    setBatch(null);
    api.quota().then((r) => setQuota(r.quota)).catch(() => undefined);
  };

  useEffect(() => () => { stopRef.current = true; }, []);

  if (!keys.eleven) {
    return <Note kind="warn">Add an ElevenLabs key on the Keys step to use AI voices — or switch to “Record my own”.</Note>;
  }

  const current = voices.find((x) => x.id === v.voiceId);
  const expressive = supportsTags(v.modelId);

  return (
    <>
      <div className="grid">
        <div className="field">
          <label>Voice</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <select
              value={v.voiceId}
              onChange={(e) => {
                const found = voices.find((x) => x.id === e.target.value);
                setV({ voiceId: e.target.value, voiceName: found?.name || '' });
              }}
              style={{ flex: 1 }}
            >
              <option value="">— pick a voice —</option>
              {voices.map((x) => <option key={x.id} value={x.id}>{x.name}{x.description ? ' — ' + x.description : ''}</option>)}
            </select>
            <button className="btn small" disabled={!current?.previewUrl} onClick={() => current && play(current.previewUrl)}>▶ Sample</button>
          </div>
          <div className="hint">Documentary-style voices with a warm, low delivery suit this format best.</div>
        </div>
        <Select label="Voice model" value={v.modelId} options={models.voice} onChange={(x) => setV({ modelId: x })} />
        <Slider label="Stability" value={v.stability} min={0} max={1} step={0.05} onChange={(x) => setV({ stability: x })}
          hint={expressive ? 'Lower follows the voice directions more freely; higher is steadier. Around 0.4–0.5 suits narration.' : 'Lower is more expressive, higher is steadier.'} />
        {expressive ? null : <Slider label="Style exaggeration" value={v.style} min={0} max={1} step={0.05} onChange={(x) => setV({ style: x })} />}
        <Slider label="Similarity" value={v.similarity} min={0} max={1} step={0.05} onChange={(x) => setV({ similarity: x })} />
        <Slider label="Speed" value={v.speed} min={0.7} max={1.2} step={0.05} suffix="×" onChange={(x) => setV({ speed: x })} />
      </div>

      <VoiceDirectionsPanel expressive={expressive} />

      <div className="toolbar" style={{ marginTop: 18 }}>
        <span className="stat">
          <b>{project.scenes.length - todo.length}</b> / {project.scenes.length} voiced
          {todo.length ? <> · {chars.toLocaleString()} characters to go</> : null}
          {quota ? <> · {(quota.limit - quota.used).toLocaleString()} left this month</> : null}
        </span>
        <div className="spacer" />
        {batch ? (
          <button className="btn small danger" onClick={() => { stopRef.current = true; }}><Spinner /> {batch.done}/{batch.total} — Stop</button>
        ) : (
          <button className="btn small primary" disabled={!v.voiceId || !todo.length} onClick={voiceAll}>🔊 Voice {todo.length} scene{todo.length === 1 ? '' : 's'}</button>
        )}
      </div>
      <ErrorNote error={error} />
      <ClipList onRedo={(s) => voiceScene(s.id).catch((e) => setError((e as Error).message))} busy={busy} redoLabel="↻" canRedo={Boolean(v.voiceId)} />
    </>
  );
};

/** The narration with its [voice directions] shown as stage directions, not as words to read. */
const Directed: React.FC<{ text: string }> = ({ text }) => (
  <>{splitTags(text).map((p, i) => (p.tag ? <span key={i} className="direction">{p.text}</span> : <React.Fragment key={i}>{p.text}</React.Fragment>))}</>
);

/**
 * ElevenLabs v4 follows audio tags. The AI (or any chatbot) adds a few to the script
 * without changing a word of it; they can all be taken out again in one click.
 */
const VoiceDirectionsPanel: React.FC<{ expressive: boolean }> = ({ expressive }) => {
  const { project, update, keys, prefs } = useStudio();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const tagged = project.scenes.filter((s) => hasTags(s.narration)).length;
  const writerKey = prefs.writer === 'claude' ? keys.claude : keys.gemini;
  const body = () => ({
    narrations: project.scenes.map((s) => s.narration), tone: project.kind === 'news' ? 'news' : project.styleId === 'ink' ? 'witty' : '', kind: project.kind || 'history', title: project.title,
  });
  const apply = (r: VoiceDirections) => {
    const changed = r.scenes.filter((s) => s.changed).length;
    update((p) => ({ ...p, scenes: p.scenes.map((sc, i) => { const got = r.scenes.find((x) => x.index === i + 1); return got && got.changed ? { ...sc, narration: got.narration } : sc; }) }));
    setNote('Voice directions added to ' + changed + ' scene' + (changed === 1 ? '' : 's') + '.'
      + (r.rejected ? ' ' + (r.rejected === 1 ? '1 scene was left as it was' : r.rejected + ' scenes were left as they were') + ', because the AI changed the words.' : '')
      + (changed ? ' Those scenes need voicing again.' : ''));
  };
  const run = async () => {
    setBusy(true);
    setError(null);
    setNote('');
    try {
      apply(await api.directVoice({ provider: prefs.writer, model: prefs.writer === 'claude' ? prefs.claudeModel : prefs.geminiModel, ...body() }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const removeAll = () => {
    if (!window.confirm('Take every voice direction out of the script?')) return;
    update((p) => ({ ...p, scenes: p.scenes.map((sc) => (hasTags(sc.narration) ? { ...sc, narration: stripTags(sc.narration) } : sc)) }));
    setNote('All voice directions removed.');
  };

  return (
    <div className="directions-box">
      <div className="row" style={{ marginTop: 0 }}>
        <b>🎭 Voice directions</b>
        <span className="stat">{tagged} of {project.scenes.length} scenes have directions like <span className="kbd">[amused]</span> or <span className="kbd">[pause]</span></span>
        <div className="spacer" />
        {expressive ? (
          <button className="btn small primary" disabled={busy || !writerKey} onClick={run} title={writerKey ? 'Adds a few audio tags. Your words are never changed.' : 'Needs a Gemini or Claude key - or use any chatbot below'}>
            {busy ? <><Spinner /> Directing…</> : '✨ Add voice directions'}
          </button>
        ) : null}
        {tagged ? <button className="btn small ghost" onClick={removeAll}>✕ Remove all</button> : null}
      </div>
      <p className="stat" style={{ margin: '6px 0 0' }}>
        {expressive
          ? 'Eleven v4 performs the directions in square brackets: one before the words it should change, about one every two or three sentences. Type your own in any scene too. They are never shown in captions or spoken as words.'
          : 'This model reads words only, so any [directions] in the script are left out when it speaks. Choose Eleven v4 to use them.'}
      </p>
      {expressive ? <ChatbotHelper<VoiceDirections> task="voice" body={body} label="Add voice directions with any chatbot" onResult={apply} /> : null}
      {note ? <Note kind="info">{note}</Note> : null}
      <ErrorNote error={error} />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Recording
// ---------------------------------------------------------------------------

const MicPanel: React.FC = () => {
  const { project, updateScene, seekScene } = useStudio();
  const [index, setIndex] = useState(() => Math.max(0, project.scenes.findIndex((s) => !s.audio || isStale(s))));
  const [mics, setMics] = useState<{ id: string; label: string }[]>([]);
  const [micId, setMicId] = useState('');
  const [open, setOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [saving, setSaving] = useState(false);
  const [level, setLevel] = useState(0);
  const [advance, setAdvance] = useState(true);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Recorder | null>(null);
  const started = useRef(0);
  const [elapsed, setElapsed] = useState(0);

  const scene = project.scenes[Math.min(index, project.scenes.length - 1)];
  const next = project.scenes[index + 1];

  useEffect(() => () => rec.current?.close(), []);

  // Meter and timer.
  useEffect(() => {
    if (!open) return;
    let raf = 0;
    const tick = () => {
      setLevel(rec.current?.level() || 0);
      if (rec.current?.recording) setElapsed((Date.now() - started.current) / 1000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [open]);

  const openMic = async (deviceId = micId) => {
    setError(null);
    try {
      rec.current?.close();
      rec.current = new Recorder();
      await rec.current.open(deviceId);
      setOpen(true);
      setMics(await listMics());
    } catch (e) {
      setError((e as Error).message);
      setOpen(false);
    }
  };

  const start = useCallback(() => {
    if (!rec.current || !scene || saving) return;
    setError(null);
    setStatus('');
    rec.current.start();
    started.current = Date.now();
    setElapsed(0);
    setRecording(true);
    seekScene(index);
  }, [scene, saving, index, seekScene]);

  const stop = useCallback(async () => {
    if (!rec.current || !scene) return;
    setRecording(false);
    setSaving(true);
    try {
      const take = await rec.current.stop();
      if (take.silent) {
        setError('That take was silent. Check the microphone picked above, and that it is not muted.');
        return;
      }
      const text = scene.narration;
      const r = await api.uploadVoice({
        projectId: project.id, sceneId: scene.id, text, audioBase64: await fileToBase64(take.wav), mimeType: 'audio/wav',
      });
      const audio: SceneAudio = {
        src: r.src,
        duration: take.duration,
        source: 'mic',
        timed: r.timed,
        text,
        words: r.timed ? r.words : estimateWords(text, take.speechStart, take.speechEnd),
      };
      updateScene(scene.id, { audio });
      setStatus('Scene ' + (index + 1) + ' saved (' + take.duration.toFixed(1) + 's' + (r.timed ? ', captions timed exactly' : '') + ').');
      if (advance && index < project.scenes.length - 1) setIndex(index + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }, [scene, project.id, project.scenes.length, index, advance, updateScene]);

  // Space to start/stop, arrows to move - but never while typing in a box.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.tagName === 'SELECT')) return;
      if (!open) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (recording) stop();
        else start();
      } else if (!recording && e.code === 'ArrowRight') setIndex((i) => Math.min(project.scenes.length - 1, i + 1));
      else if (!recording && e.code === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, recording, start, stop, project.scenes.length]);

  if (!scene) return null;

  return (
    <>
      {!open ? (
        <Note kind="info" title="Recording tips">
          <ul>
            <li>A quiet room with soft furnishings (curtains, sofa) sounds far better than a bare one.</li>
            <li>Keep the mic a hand's width away, a little to the side of the mouth.</li>
            <li>Read one scene per take. Silence before and after is trimmed automatically, and the level is evened out.</li>
            <li>Press <span className="kbd">Space</span> to start and stop. It moves to the next scene by itself.</li>
          </ul>
        </Note>
      ) : null}

      <div className={'prompter' + (recording ? ' rec' : '')}>
        <div className="which">
          <b>Scene {index + 1} of {project.scenes.length}</b>
          {scene.audio ? (isStale(scene) ? <span className="pill warn">text changed — re-record</span> : <span className="pill good">recorded {scene.audio.source === 'mic' ? '🎙️' : '🤖'}</span>) : <span className="pill">not recorded</span>}
          {recording ? <><span className="recdot" /> <span>{elapsed.toFixed(1)}s</span></> : null}
          {saving ? <><Spinner /> saving…</> : null}
          {open ? <div className="meter"><div style={{ width: Math.round(level * 100) + '%' }} /></div> : null}
        </div>
        <div className="text">{scene.narration ? <Directed text={scene.narration} /> : <i style={{ color: 'var(--dim)' }}>This scene has no words yet.</i>}</div>
        {next ? <div className="next">Next: {stripTags(next.narration)}</div> : null}
      </div>

      <div className="toolbar">
        {!open ? (
          <button className="btn primary" onClick={() => openMic()}>🎙️ Turn on the microphone</button>
        ) : recording ? (
          <button className="btn primary" style={{ background: 'var(--bad)', borderColor: 'var(--bad)' }} onClick={stop}>■ Stop <span className="kbd">Space</span></button>
        ) : (
          <button className="btn primary" disabled={saving || !scene.narration.trim()} onClick={start}>
            ● {scene.audio ? 'Re-record' : 'Record'} <span className="kbd">Space</span>
          </button>
        )}
        <button className="btn small" disabled={recording || index === 0} onClick={() => setIndex(index - 1)}>← Prev</button>
        <button className="btn small" disabled={recording || index >= project.scenes.length - 1} onClick={() => setIndex(index + 1)}>Next →</button>
        {scene.audio ? <button className="btn small" disabled={recording} onClick={() => play(mediaUrl(scene.audio!.src))}>▶ Play take</button> : null}
        <div className="spacer" />
        <Check label="Auto-advance" checked={advance} onChange={setAdvance} />
      </div>
      {open && mics.length > 1 ? (
        <div style={{ maxWidth: 420 }}>
          <Select
            label="Microphone"
            value={micId}
            options={[{ id: '', label: 'System default' }, ...mics]}
            onChange={(id) => { setMicId(id); openMic(id); }}
          />
        </div>
      ) : null}
      {status ? <Note kind="good">{status}</Note> : null}
      <ErrorNote error={error} />

      <ClipList onPick={(i) => { if (!recording) setIndex(i); }} currentIndex={index} />
    </>
  );
};

// ---------------------------------------------------------------------------

const ClipList: React.FC<{
  onRedo?: (s: Scene) => void;
  onPick?: (i: number) => void;
  busy?: Record<string, boolean>;
  redoLabel?: string;
  canRedo?: boolean;
  currentIndex?: number;
}> = ({ onRedo, onPick, busy = {}, redoLabel, canRedo, currentIndex }) => {
  const { project, updateScene, seekScene } = useStudio();
  return (
    <div className="clips">
      {project.scenes.map((s, i) => {
        const stale = isStale(s);
        return (
          <div key={s.id} className={'clip-row' + (currentIndex === i ? ' current' : '')} onClick={() => { onPick?.(i); seekScene(i); }}>
            <span className="stat"><b>{i + 1}</b></span>
            <span className="txt" title={s.narration}>{s.narration ? <Directed text={s.narration} /> : '—'}</span>
            <span className="right" onClick={(e) => e.stopPropagation()}>
              {s.audio ? (
                <>
                  <span className={'pill ' + (stale ? 'warn' : 'good')}>{s.audio.source === 'mic' ? '🎙️' : '🤖'} {s.audio.duration.toFixed(1)}s{stale ? ' · out of date' : ''}</span>
                  <button className="icon-btn" title="Play" onClick={() => play(mediaUrl(s.audio!.src))}>▶</button>
                  <button className="icon-btn" title="Remove this clip" onClick={() => updateScene(s.id, { audio: null })}>✕</button>
                </>
              ) : <span className="pill">no voice</span>}
              {onRedo ? (
                <button className="icon-btn" title="Voice this scene" disabled={!canRedo || busy[s.id] || !s.narration.trim()} onClick={() => onRedo(s)}>
                  {busy[s.id] ? <Spinner /> : redoLabel}
                </button>
              ) : null}
            </span>
          </div>
        );
      })}
    </div>
  );
};
