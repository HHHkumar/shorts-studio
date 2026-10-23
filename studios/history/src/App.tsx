import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PlayerRef } from '@remotion/player';
import { api, setKeys, type Keys, type Option } from './lib/api';
import { newProject } from './lib/demo';
import { migrateProject } from './lib/migrate';
import { useStoredState } from './lib/store';
import { buildTimeline, formatDuration } from './lib/timeline';
import { FPS, type Project, type Scene, type Shot } from './lib/types';
import { StudioContext, type Prefs, type Studio } from './ui/context';
import { ErrorNote, Note } from './ui/controls';
import { Home } from './ui/Home';
import { Preview } from './ui/Preview';
import { StepKeys } from './ui/StepKeys';
import { StepLook } from './ui/StepLook';
import { StepRender } from './ui/StepRender';
import { StepScenes } from './ui/StepScenes';
import { StepStory } from './ui/StepStory';
import { StepVoice } from './ui/StepVoice';

const STEPS = ['Keys', 'Story', 'Scenes & pictures', 'Voice', 'Look', 'Render'];

const DEFAULT_PREFS: Prefs = {
  writer: 'gemini',
  geminiModel: 'gemini-2.5-flash',
  claudeModel: 'claude-opus-5',
  imageModel: 'gemini-3.1-flash-image',
  videoModel: 'veo-3.1-fast-generate-preview',
};

export const App: React.FC = () => {
  const [geminiKey, setGeminiKey] = useStoredState('geminiKey', '');
  const [claudeKey, setClaudeKey] = useStoredState('claudeKey', '');
  const [elevenKey, setElevenKey] = useStoredState('elevenKey', '');
  const [pexelsKey, setPexelsKey] = useStoredState('pexelsKey', '');
  const [pixabayKey, setPixabayKey] = useStoredState('pixabayKey', '');
  const keys: Keys = useMemo(() => ({ gemini: geminiKey, claude: claudeKey, eleven: elevenKey, pexels: pexelsKey, pixabay: pixabayKey }), [geminiKey, claudeKey, elevenKey, pexelsKey, pixabayKey]);
  setKeys(keys);

  const [prefs, setPrefsState] = useStoredState<Prefs>('prefs', DEFAULT_PREFS);
  const setPrefs = useCallback((fn: (p: Prefs) => Prefs) => setPrefsState((p) => fn(p)), [setPrefsState]);
  const [step, setStep] = useStoredState('step', 0);
  const [projectId, setProjectId] = useStoredState('projectId', '');
  const [project, setProject] = useState<Project | null>(null);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error' | ''>('');
  const [error, setError] = useState<string | null>(null);
  const [serverUp, setServerUp] = useState<boolean | null>(null);

  const [models, setModels] = useState<Studio['models']>({ gemini: [], claude: [], voice: [], image: [], video: [] });

  // The helper and the page start together; the page often wins. Keep asking for a bit.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (let i = 0; i < 20 && !cancelled; i++) {
        try {
          const h = await api.health();
          if (cancelled) return;
          setServerUp(true);
          setModels((m) => ({ ...m, claude: h.claudeModels, voice: h.voiceModels, image: h.imageModels }));
          return;
        } catch {
          await new Promise((r) => setTimeout(r, 700));
        }
      }
      if (!cancelled) setServerUp(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // Live model lists, once there is a key to ask with.
  useEffect(() => {
    if (!serverUp || !geminiKey.trim()) return;
    api.geminiModels().then((r) => setModels((m) => ({ ...m, gemini: r.models }))).catch(() => undefined);
    api.videoModels().then((r) => setModels((m) => ({ ...m, video: r.models }))).catch(() => undefined);
  }, [serverUp, geminiKey]);
  useEffect(() => {
    if (!serverUp || !claudeKey.trim()) return;
    api.claudeModels().then((r) => setModels((m) => ({ ...m, claude: r.models }))).catch(() => undefined);
  }, [serverUp, claudeKey]);

  // Reopen the project that was open last time.
  useEffect(() => {
    if (!serverUp || !projectId || project) return;
    api.openProject(projectId).then((r) => setProject(migrateProject(r.project))).catch(() => setProjectId(''));
  }, [serverUp, projectId, project, setProjectId]);

  // Saved a moment after the last change, not on every keystroke.
  const firstLoad = useRef(true);
  useEffect(() => {
    if (!project) return;
    if (firstLoad.current) {
      firstLoad.current = false;
      return;
    }
    setSaveState('saving');
    const t = setTimeout(() => {
      api.saveProject(project).then(() => setSaveState('saved')).catch(() => setSaveState('error'));
    }, 900);
    return () => clearTimeout(t);
  }, [project]);

  const update = useCallback((fn: (p: Project) => Project) => setProject((p) => (p ? fn(p) : p)), []);
  const updateScene = useCallback(
    (id: string, patch: Partial<Scene> | ((s: Scene) => Partial<Scene>)) =>
      setProject((p) => (p ? {
        ...p,
        scenes: p.scenes.map((s) => (s.id === id ? { ...s, ...(typeof patch === 'function' ? patch(s) : patch) } : s)),
      } : p)),
    [],
  );

  const updateShot = useCallback(
    (shotId: string, patch: Partial<Shot> | ((s: Shot) => Partial<Shot>)) =>
      setProject((p) => (p ? {
        ...p,
        scenes: p.scenes.map((sc) => (sc.shots.some((s) => s.id === shotId)
          ? { ...sc, shots: sc.shots.map((s) => (s.id === shotId ? { ...s, ...(typeof patch === 'function' ? patch(s) : patch) } : s)) }
          : sc)),
      } : p)),
    [],
  );

  const playerRef = useRef<PlayerRef>(null);
  const timeline = useMemo(() => (project ? buildTimeline(project) : null), [project]);
  const seekScene = useCallback((index: number) => {
    const s = timeline?.scenes[index];
    if (s && playerRef.current) playerRef.current.seekTo(s.startFrame + Math.min(8, s.durationInFrames - 1));
  }, [timeline]);

  const openProject = async (id: string) => {
    setError(null);
    try {
      const r = await api.openProject(id);
      firstLoad.current = true;
      setProject(migrateProject(r.project));
      setProjectId(id);
      setStep(r.project.scenes?.length ? 2 : 1);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const createProject = async () => {
    setError(null);
    try {
      const { id } = await api.newId();
      const p = newProject(id);
      await api.saveProject(p);
      firstLoad.current = true;
      setProject(p);
      setProjectId(id);
      setStep(geminiKey || claudeKey ? 1 : 0);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const closeProject = () => {
    if (project) api.saveProject(project).catch(() => undefined);
    setProject(null);
    setProjectId('');
    setSaveState('');
  };

  const studio: Studio | null = project ? {
    project, update, updateScene, updateShot, keys, prefs, setPrefs, models, seekScene, goStep: setStep,
  } : null;

  const hasScript = Boolean(project && project.scenes.length);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo">🏺</span>History <span>Studio</span>
          <small>
            Illustrated history explainers ·{' '}
            <a className="studio-link" href="/" title="Quiz shorts and explainers, 9:16">Quiz shorts →</a>
          </small>
        </div>
        {project ? (
          <>
            <button className="btn small ghost" onClick={closeProject}>← All projects</button>
            <div className="proj-name">{project.title || project.topic || 'Untitled project'}</div>
            <div className="save-state">
              {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved ✓' : saveState === 'error' ? 'Not saved!' : ''}
            </div>
            <nav className="steps">
              {STEPS.map((label, i) => (
                <button
                  key={label}
                  className={'step-chip' + (i === step ? ' active' : '')}
                  disabled={i >= 2 && !hasScript}
                  onClick={() => setStep(i)}
                >
                  <span className="num">{i + 1}</span>
                  {label}
                </button>
              ))}
            </nav>
          </>
        ) : null}
      </header>

      {serverUp === false ? (
        <div style={{ padding: 26 }}>
          <Note kind="error" title="The helper is not running">
            Close this tab, then start the studio again: run <span className="kbd">npm start</span> in the shorts-studio folder. History Studio now opens from inside Shorts Studio.
          </Note>
        </div>
      ) : null}

      {!project || !studio ? (
        <main style={{ padding: 26, maxWidth: 1300, margin: '0 auto', width: '100%' }}>
          <ErrorNote error={error} />
          {serverUp ? (
            <Home
              onOpen={openProject}
              onNew={createProject}
              keysPanel={
                <StepKeys
                  keys={keys}
                  setGemini={setGeminiKey}
                  setClaude={setClaudeKey}
                  setEleven={setElevenKey}
                  setPexels={setPexelsKey}
                  setPixabay={setPixabayKey}
                />
              }
            />
          ) : serverUp === null ? <p style={{ color: 'var(--dim)' }}>Starting up…</p> : null}
        </main>
      ) : (
        <StudioContext.Provider value={studio}>
          <main className="main">
            <div>
              {step === 0 ? (
                <div className="panel">
                  <StepKeys keys={keys} setGemini={setGeminiKey} setClaude={setClaudeKey} setEleven={setElevenKey} setPexels={setPexelsKey} setPixabay={setPixabayKey} />
                  <div className="actions">
                    <div className="spacer" />
                    <button className="btn primary" onClick={() => setStep(1)}>Next: the story →</button>
                  </div>
                </div>
              ) : null}
              {step === 1 ? <StepStory /> : null}
              {step === 2 ? <StepScenes /> : null}
              {step === 3 ? <StepVoice /> : null}
              {step === 4 ? <StepLook /> : null}
              {step === 5 && timeline ? <StepRender timeline={timeline} /> : null}
            </div>
            <aside className="preview-col">
              {timeline && project.scenes.length ? (
                <>
                  <Preview ref={playerRef} props={timeline} />
                  <div className="preview-meta">
                    <span>{project.scenes.length} scenes</span>
                    <span>{formatDuration(timeline.totalFrames / FPS)} long</span>
                  </div>
                  <Checklist project={project} />
                </>
              ) : (
                <div className="panel" style={{ color: 'var(--dim)' }}>
                  The preview appears here as soon as there is a script.
                </div>
              )}
            </aside>
          </main>
        </StudioContext.Provider>
      )}
    </div>
  );
};

const Checklist: React.FC<{ project: Project }> = ({ project }) => {
  const n = project.scenes.length;
  const shots = project.scenes.flatMap((s) => s.shots);
  const pics = shots.filter((s) => s.image || s.graphic).length;
  const voiced = project.scenes.filter((s) => s.audio).length;
  const items = [
    { done: n > 0, text: n + ' scenes written' },
    { done: n > 0 && pics === shots.length, text: pics + ' of ' + shots.length + ' pictures & graphics' },
    { done: n > 0 && voiced === n, text: voiced + ' of ' + n + ' scenes voiced' },
  ];
  return (
    <div className="checklist">
      {items.map((it) => (
        <div key={it.text} className={it.done ? 'done' : ''}>
          <span>{it.done ? '✓' : '○'}</span>
          {it.text}
        </div>
      ))}
    </div>
  );
};

export type { Option };
