import React, { useEffect, useMemo, useState } from 'react';
import {
  api,
  DEFAULT_TOPIC_FORM,
  DEFAULT_VOICE_SETTINGS,
  onSpend,
  type Spend,
  type TopicForm,
  type SeoPack,
  type ValidationReport,
  type VoiceSettings,
} from './lib/api';
import { clearStored, useStoredState } from './lib/store';
import { DEFAULT_DESIGN } from './lib/theme';
import { buildScenes, type AudioResult } from './lib/timeline';
import type { DesignSettings, QuizContent, VideoProps } from './lib/types';
import { FPS } from './lib/types';
import { Preview } from './ui/Preview';
import { StepExport } from './ui/StepExport';
import { StepKeys } from './ui/StepKeys';
import { StepPublish } from './ui/StepPublish';
import { StepScript } from './ui/StepScript';
import { StepStyle } from './ui/StepStyle';
import { StepTopic } from './ui/StepTopic';
import { StepVoice } from './ui/StepVoice';
import { MascotLab } from './ui/MascotLab';
import { LibraryView } from './ui/LibraryView';
import { PlannerView } from './ui/PlannerView';
import { Note } from './ui/controls';
import { tidySheet } from './lib/formula-card';
import { shiftAudio } from './lib/script-edit';

const STEPS = ['Keys', 'Topic', 'Script', 'Voice', 'Look', 'Export', 'Publish'];

export const App: React.FC = () => {
  const [step, setStep] = useState(0);
  // The mascot lab sits outside the steps: the character is designed once for
  // the channel, not per video, so it must be reachable with no video open.
  const [lab, setLab] = useState(false);

  const [geminiKey, setGeminiKey] = useStoredState('geminiKey', '');
  const [elevenKey, setElevenKey] = useStoredState('elevenKey', '');
  const [deepseekKey, setDeepseekKey] = useStoredState('deepseekKey', '');
  const [claudeKey, setClaudeKey] = useStoredState('claudeKey', '');
  const [pexelsKey, setPexelsKey] = useStoredState('pexelsKey', '');
  const [deepseekModel, setDeepseekModel] = useStoredState('deepseekModel', 'deepseek-chat');
  const [geminiModel, setGeminiModel] = useStoredState('geminiModel', 'gemini-2.5-flash');
  const [claudeModel, setClaudeModel] = useStoredState('claudeModel', 'claude-opus-5');
  const [form, setForm] = useStoredState<TopicForm>('topicForm', DEFAULT_TOPIC_FORM);
  const [voiceSettings, setVoiceSettings] = useStoredState<VoiceSettings>('voice', DEFAULT_VOICE_SETTINGS);
  const [design, setDesign] = useStoredState<DesignSettings>('design', DEFAULT_DESIGN);
  const [content, setContent] = useStoredState<QuizContent | null>('content', null);
  const [audio, setAudio] = useStoredState<Record<number, AudioResult>>('audio', {});
  const [report, setReport] = useStoredState<ValidationReport | null>('validation', null);
  const [seo, setSeo] = useStoredState<SeoPack | null>('seo', null);
  const [channelName, setChannelName] = useStoredState('channelName', '');
  // The video being worked on, in the library (server/library.mjs), and what it has cost.
  const [videoId, setVideoId] = useStoredState('videoId', '');
  const [ledger, setLedger] = useStoredState<Spend[]>('ledger', []);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [plannerOpen, setPlannerOpen] = useState(false);
  // A planned question being made by hand: marked done once its video has an id.
  // Armed only once its question is generated: before that, the video open is a different one.
  const [pendingPlanItem, setPendingPlanItem] = useState<{ planId: string; itemId: string; armed: boolean } | null>(null);
  const [libraryNotes, setLibraryNotes] = useState<string[]>([]);

  // Every paid call reports here (lib/api.ts), so no screen can forget to count.
  useEffect(() => {
    onSpend((s) => setLedger((prev) => [...prev, s]));
    return () => onSpend(null);
  }, [setLedger]);

  // A video with no library id yet - one made before the library existed, or
  // just generated - gets one.
  useEffect(() => {
    if (content && !videoId) {
      api.libraryNewId().then((r) => setVideoId(r.id)).catch(() => undefined);
    }
  }, [content, videoId, setVideoId]);

  // The planned question just made by hand is done, and linked to its video.
  useEffect(() => {
    if (pendingPlanItem && pendingPlanItem.armed && content && videoId) {
      api.updatePlanItem(pendingPlanItem.planId, pendingPlanItem.itemId, { status: 'done', videoId }).catch(() => undefined);
      setPendingPlanItem(null);
    }
  }, [pendingPlanItem, content, videoId]);

  // Saved as it changes, a moment after the last edit rather than on every keystroke.
  useEffect(() => {
    if (!content || !videoId) return;
    const t = setTimeout(() => {
      api.librarySave({ id: videoId, content, design, audio, seo, ledger }).catch(() => undefined);
    }, 1200);
    return () => clearTimeout(t);
  }, [content, design, audio, seo, ledger, videoId]);

  /** A fresh video: a new library entry, an empty ledger. The old one is already saved. */
  const startFresh = () => {
    setVideoId('');
    setLedger([]);
    setLibraryNotes([]);
  };

  const openVideo = async (id: string) => {
    const { video } = await api.libraryOpen(id);
    setVideoId(video.id);
    setContent(video.content);
    setAudio(video.audio || {});
    if (video.design) setDesign(video.design);
    setSeo((video.seo as SeoPack | null) ?? null);
    setLedger(video.ledger || []);
    setReport(null);
    setLibraryNotes(video.notes || []);
    setLibraryOpen(false);
    go(2);
  };

  const [models, setModels] = useState<{ id: string; label: string }[]>([]);
  const [claudeModels, setClaudeModels] = useState<{ id: string; label: string }[]>([]);
  const [voiceModels, setVoiceModels] = useState<{ id: string; label: string }[]>([]);
  const [musicMoods, setMusicMoods] = useState<{ id: string; label: string }[]>([]);
  const [deepseekModels, setDeepseekModels] = useState<{ id: string; label: string }[]>([]);
  const [imageModels, setImageModels] = useState<{ id: string; label: string }[]>([]);
  const [imageStyles, setImageStyles] = useState<{ id: string; label: string }[]>([]);
  const [googleImageModels, setGoogleImageModels] = useState<{ id: string; label: string }[]>([]);
  const [serverDown, setServerDown] = useState(false);
  const [waitingForServer, setWaitingForServer] = useState(true);

  /**
   * Wait for the helper rather than giving up on it.
   *
   * Both halves start together, and the browser opens as soon as the web half
   * is ready - which is well before node has finished loading the other one. A
   * single attempt therefore lost the race on a cold start and put a permanent
   * "the helper is not running" banner in front of a helper that was seconds
   * from being up. Keep asking for a while before saying that.
   */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const deadline = Date.now() + 20000;
      for (let attempt = 0; !cancelled; attempt++) {
        try {
          const res = await fetch('/api/health');
          if (!res.ok) throw new Error('bad status');
          const data = await res.json();
          if (cancelled) return;
          setModels(data.geminiModels || []);
          setClaudeModels(data.claudeModels || []);
          setVoiceModels(data.voiceModels || []);
          setMusicMoods(data.musicMoods || []);
          setDeepseekModels(data.deepseekModels || []);
          setImageModels(data.imageModels || []);
          setImageStyles(data.imageStyles || []);
          setGoogleImageModels(data.googleImageModels || []);
          setServerDown(false);
          setWaitingForServer(false);
          return;
        } catch {
          if (Date.now() >= deadline) {
            if (!cancelled) {
              setServerDown(true);
              setWaitingForServer(false);
            }
            return;
          }
          // Quick at first, because it is usually ready within a second or two.
          await new Promise((r) => setTimeout(r, Math.min(1500, 250 + attempt * 250)));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Ask Google which models this key can actually use, so the dropdown can never
  // offer something that 404s. Falls back to the static list if the call fails.
  useEffect(() => {
    const key = geminiKey.trim();
    if (key.length < 10) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await api.geminiModels(key);
        if (cancelled || !list.length) return;
        setModels(list);
        setGeminiModel((current) => (list.some((m) => m.id === current) ? current : list[0].id));
      } catch {
        // Keep whatever the fallback list gave us; /api/generate will explain
        // clearly if the chosen model turns out to be unavailable.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [geminiKey, setGeminiModel]);

  // Same for Claude, against the user's own key.
  useEffect(() => {
    const key = claudeKey.trim();
    if (key.length < 10) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await api.claudeModels(key);
        if (cancelled || !list.length) return;
        setClaudeModels(list);
        setClaudeModel((current) => (list.some((m) => m.id === current) ? current : list[0].id));
      } catch {
        // The static list stays; /api/generate explains any real problem.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [claudeKey, setClaudeModel]);

  const hasAudio = Object.keys(audio).length > 0;

  // The single source of truth for both the preview and the render.
  const videoProps: VideoProps | null = useMemo(() => {
    if (!content) return null;
    const { scenes, totalDurationInFrames } = buildScenes(content.script, audio, design, FPS, tidySheet(content.formulas)?.cards.length ?? 0);
    return { content, scenes, design, fps: FPS, totalDurationInFrames };
  }, [content, audio, design]);

  const unlocked = (index: number): boolean => {
    if (index <= 1) return geminiKey.trim().length > 5 && elevenKey.trim().length > 5;
    if (index === 2 || index === 3) return !!content;
    return !!content && (index === 4 || hasAudio || index === 5 || index === 6);
  };

  const go = (n: number) => {
    setStep(n);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const reset = () => {
    clearStored();
    setGeminiKey('');
    setElevenKey('');
    setForm(DEFAULT_TOPIC_FORM);
    setVoiceSettings(DEFAULT_VOICE_SETTINGS);
    setDesign(DEFAULT_DESIGN);
    setContent(null);
    setAudio({});
    setReport(null);
    setSeo(null);
    setChannelName('');
    setDeepseekKey('');
    setPexelsKey('');
    startFresh();
    go(0);
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          Shorts<span>Studio</span>
          <small>AI quiz videos, 9:16</small>
        </div>
        <nav className="steps">
          {STEPS.map((label, i) => (
            <button
              key={label}
              className={'step-chip' + (step === i ? ' active' : i < step && unlocked(i) ? ' done' : '')}
              disabled={!unlocked(i)}
              onClick={() => go(i)}
            >
              <span className="num">{i + 1}</span>
              {label}
            </button>
          ))}
          <button
            className={'step-chip mascot-chip' + (plannerOpen ? ' active' : '')}
            onClick={() => { setLab(false); setLibraryOpen(false); setPlannerOpen((on) => !on); }}
            title="Plan a series across an exam's syllabus, and make several at once"
          >
            Planner
          </button>
          <button
            className={'step-chip mascot-chip' + (libraryOpen ? ' active' : '')}
            onClick={() => { setLab(false); setPlannerOpen(false); setLibraryOpen((on) => !on); }}
            title="Every video you have made"
          >
            Library
          </button>
          <button
            className={'step-chip mascot-chip' + (lab ? ' active' : '')}
            onClick={() => { setLibraryOpen(false); setPlannerOpen(false); setLab((on) => !on); }}
            title="Design and test the doodle mascot"
          >
            Mascot
          </button>
        </nav>
      </header>

      <div className="main">
        <div>
          {waitingForServer ? (
            <Note kind="info" title="Starting up…">
              Waiting for the helper to finish loading. This takes a couple of seconds on a cold
              start and clears by itself.
            </Note>
          ) : serverDown ? (
            <Note kind="error" title="The helper server is not running">
              Close this tab, go back to the terminal window, and run <span className="kbd">npm start</span>{' '}
              inside the <span className="kbd">shorts-studio</span> folder. Then reload this page.
            </Note>
          ) : null}

          {lab ? <MascotLab geminiKey={geminiKey} onClose={() => setLab(false)} /> : null}

          {libraryOpen ? (
            <LibraryView
              currentId={content ? videoId : ''}
              onOpen={(id) => { openVideo(id).catch((e) => alert(e instanceof Error ? e.message : String(e))); }}
              onTranslate={async (id, language) => {
                // A copy in the new language becomes its own video: same look and
                // formulas, no voice yet - the Voice step records it.
                const { video } = await api.libraryOpen(id);
                const { content: translated } = await api.translate({ apiKey: geminiKey, model: geminiModel, content: video.content, language });
                const { id: newId } = await api.libraryNewId();
                await api.librarySave({ id: newId, content: translated, design: video.design || design, audio: {}, seo: null, ledger: [] });
                await openVideo(newId);
              }}
              onNew={() => {
                setLibraryOpen(false);
                startFresh();
                setContent(null);
                setAudio({});
                setReport(null);
                setSeo(null);
                go(1);
              }}
              onClose={() => setLibraryOpen(false)}
            />
          ) : null}

          {plannerOpen ? (
            <PlannerView
              geminiKey={geminiKey}
              geminiModel={geminiModel}
              elevenKey={elevenKey}
              deepseekKey={deepseekKey}
              deepseekModel={deepseekModel}
              form={form}
              design={design}
              voice={voiceSettings}
              onMakeByHand={(plan, item) => {
                setForm({ ...form, contentType: 'electrical', videoKind: 'mcq', exam: plan.exam, subject: item.subject || form.subject,
                  topic: item.topic, difficulty: item.difficulty || form.difficulty,
                  extra: item.angle ? 'The question should test: ' + item.angle : form.extra });
                setPendingPlanItem({ planId: plan.id, itemId: item.id, armed: false });
                setPlannerOpen(false);
                go(1);
              }}
              onOpenVideo={(id) => { openVideo(id).then(() => setPlannerOpen(false)).catch((e) => alert(e instanceof Error ? e.message : String(e))); }}
              onClose={() => setPlannerOpen(false)}
            />
          ) : null}

          {libraryNotes.length && !libraryOpen && !lab ? (
            <Note kind="warn" title="Opened from the library">
              {libraryNotes.map((n) => <div key={n}>{n}</div>)}
            </Note>
          ) : null}

          {/* Hidden rather than unmounted while the lab is open, so anything
              half-done on a step is still there on the way back. */}
          <div hidden={lab || libraryOpen || plannerOpen}>
          {step === 0 ? (
            <StepKeys
              geminiKey={geminiKey}
              geminiModel={geminiModel}
              elevenKey={elevenKey}
              deepseekKey={deepseekKey}
              claudeKey={claudeKey}
              pexelsKey={pexelsKey}
              setGeminiKey={setGeminiKey}
              setElevenKey={setElevenKey}
              setDeepseekKey={setDeepseekKey}
              setClaudeKey={setClaudeKey}
              setPexelsKey={setPexelsKey}
              onNext={() => go(1)}
            />
          ) : null}

          {step === 1 ? (
            <StepTopic
              form={form}
              setForm={setForm}
              geminiKey={geminiKey}
              geminiModel={geminiModel}
              setGeminiModel={setGeminiModel}
              geminiModels={models}
              claudeKey={claudeKey}
              claudeModel={claudeModel}
              setClaudeModel={setClaudeModel}
              claudeModels={claudeModels}
              design={design}
              setDesign={setDesign}
              onBack={() => go(0)}
              onGenerated={(c) => {
                startFresh(); // a new question is a new video in the library
                setPendingPlanItem((p) => (p ? { ...p, armed: true } : p));
                setContent(c);
                setAudio({}); // a new question means the old voiceover is meaningless
                setReport(null); // and the old fact-check is about a different question
                setSeo(null); // and the old title and tags describe a different video
                go(2);
              }}
            />
          ) : null}

          {step === 2 && content ? (
            <StepScript
              content={content}
              setContent={(fn) => setContent((prev) => (prev ? fn(prev) : prev))}
              hasAudio={hasAudio}
              onEdited={() => setAudio({})}
              // Only the edited scene's clip goes; the Voice step records just that one.
              onSceneEdited={(index) => setAudio((prev) => {
                if (!(index in prev)) return prev;
                const next = { ...prev };
                delete next[index];
                return next;
              })}
              // One scene in or out: the others keep their clips, moved to their new places.
              onSceneInserted={(at) => setAudio((prev) => shiftAudio(prev, at, 1))}
              onSceneRemoved={(at) => setAudio((prev) => shiftAudio(prev, at, -1))}
              geminiKey={geminiKey}
              geminiModel={geminiModel}
              deepseekKey={deepseekKey}
              deepseekModel={deepseekModel}
              setDeepseekModel={setDeepseekModel}
              deepseekModels={deepseekModels}
              form={form}
              report={report}
              setReport={setReport}
              onBack={() => go(1)}
              onNext={() => go(3)}
            />
          ) : null}

          {step === 3 && content ? (
            <StepVoice
              elevenKey={elevenKey}
              content={content}
              settings={voiceSettings}
              setSettings={setVoiceSettings}
              voiceModels={voiceModels}
              audio={audio}
              onAudio={setAudio}
              onBack={() => go(2)}
              onNext={() => go(4)}
            />
          ) : null}

          {step === 4 ? (
            <StepStyle
              design={design}
              setDesign={setDesign}
              musicMoods={musicMoods}
              content={content}
              setContent={(fn) => setContent((prev) => (prev ? fn(prev) : prev))}
              pexelsKey={pexelsKey}
              elevenKey={elevenKey}
              form={form}
              imageModels={imageModels}
              imageStyles={imageStyles}
              googleImageModels={googleImageModels}
              geminiKey={geminiKey}
              geminiModel={geminiModel}
              onOpenMascot={() => setLab(true)}
              onBack={() => go(3)}
              onNext={() => go(5)}
            />
          ) : null}

          {step === 5 && videoProps ? (
            <StepExport
              props={videoProps}
              hasAudio={hasAudio}
              onBack={() => go(4)}
              videoId={videoId}
              onNewQuestion={() => {
                startFresh();
                setContent(null);
                setAudio({});
                setReport(null);
                setSeo(null);
                go(1);
              }}
              onReset={reset}
            />
          ) : null}

          {step === 6 && content ? (
            <StepPublish
              content={content}
              form={form}
              geminiKey={geminiKey}
              geminiModel={geminiModel}
              channelName={channelName}
              setChannelName={setChannelName}
              seo={seo}
              setSeo={setSeo}
              orientation={design.orientation}
              design={design}
              videoProps={videoProps}
              googleImageModels={googleImageModels}
              onBack={() => go(5)}
            />
          ) : null}
          </div>
        </div>

        <Preview props={step >= 2 ? videoProps : null} hasAudio={hasAudio} />
      </div>
    </div>
  );
};
