import React, { useMemo, useState } from 'react';
import { api, type StoryResult } from '../lib/api';
import { blankScene, countWords, splitScript, WORDS_PER_MINUTE } from '../lib/script';
import { ART_STYLES, styleFor } from '../lib/styles';
import { formatDuration } from '../lib/timeline';
import type { Effect, Motion, Project } from '../lib/types';
import { useStudio } from './context';
import { ErrorNote, Field, Note, Select, Slider, Spinner, TextArea, TextInput } from './controls';
import { ChatbotHelper } from './ChatbotHelper';
import { NewsStory } from './NewsStory';
import { supportsTags } from '../lib/speech';

const IDEAS = [
  'How did people keep food cold before refrigerators?',
  'How did medieval people clean their teeth?',
  'How did ancient Indians build stepwells to survive drought?',
  'What did Roman soldiers actually eat on the march?',
  'How did people wake up on time before alarm clocks?',
  'How did sailors find their way across oceans without GPS?',
  'How were castles kept warm in winter?',
  'How did the Mughals keep their palaces cool?',
];

const TONES = [
  { id: 'immersive', t: 'Immersive "you are there"', s: '"You wake up and the air is already trying to kill you." Like the reference video.' },
  { id: 'documentary', t: 'Documentary', s: 'Calm, authoritative narrator.' },
  { id: 'storyteller', t: 'Storyteller', s: 'Warm, follows ordinary people through the story.' },
  { id: 'playful', t: 'Playful', s: 'Witty, surprising modern comparisons.' },
  { id: 'witty', t: 'Deadpan & witty', s: 'Dry one-liners, a running gag, a picture on every phrase. Pairs with the ink cartoon look.' },
];

const LANGUAGES = ['English', 'Hindi', 'Kannada', 'Tamil', 'Telugu', 'Malayalam', 'Marathi', 'Bengali', 'Spanish', 'French', 'German', 'Portuguese', 'Arabic', 'Japanese'];

/** Apply what the writer returned. Narration from the result, or kept from `narrations` when directing her own script. */
export function applyStory(p: Project, r: StoryResult, narrations?: string[]): Project {
  // The plan describes each scene's opening shot; any later shots are hers.
  const scenes = narrations
    ? p.scenes.map((s, i) => {
      const plan = r.scenes[i];
      if (!plan) return s;
      const [first, ...rest] = s.shots;
      return {
        ...s,
        effect: (plan.effect as Effect) || s.effect,
        chapter: s.chapter || plan.chapter || '',
        shots: [{ ...first, imagePrompt: plan.imagePrompt || first.imagePrompt, motion: (plan.motion as Motion) || first.motion, stockQuery: plan.stockQuery || first.stockQuery }, ...rest],
      };
    })
    : r.scenes.map((s) => {
      const scene = blankScene(s.narration || '');
      return {
        ...scene,
        effect: s.effect as Effect,
        chapter: s.chapter || '',
        shots: [{ ...scene.shots[0], imagePrompt: s.imagePrompt, motion: s.motion as Motion, stockQuery: s.stockQuery || '' }],
      };
    });
  return {
    ...p,
    title: p.title && narrations ? p.title : r.title || p.title,
    styleBible: r.styleBible || p.styleBible,
    scenes,
    publish: { description: r.description, tags: r.tags, titleIdeas: r.titleIdeas, factNotes: r.factNotes },
  };
}

export const StepStory: React.FC = () => {
  const { project, update, keys, prefs, setPrefs, models, goStep } = useStudio();
  const [mode, setMode] = useState<'ai' | 'own'>(project.scenes.length && !project.topic ? 'own' : 'ai');
  const [notes, setNotes] = useState('');
  const [minutes, setMinutes] = useState(8);
  const [tone, setTone] = useState('immersive');
  const [audience, setAudience] = useState('');
  const [pasted, setPasted] = useState('');
  const [busy, setBusy] = useState<'' | 'write' | 'direct'>('');
  const [error, setError] = useState<string | null>(null);

  const writerKey = prefs.writer === 'claude' ? keys.claude : keys.gemini;
  const news = project.kind === 'news';
  /** An ElevenLabs v4 voice follows [voice directions], so the writer adds a few. */
  const voiceTags = project.voice.mode === 'eleven' && supportsTags(project.voice.modelId);
  /** History or news. Switching to news picks news-friendly looks, which she can still change. */
  const setKind = (kind: 'history' | 'news') => update((p) => {
    if (p.kind === kind) return p;
    if (kind === 'history') return { ...p, kind };
    return {
      ...p,
      kind,
      region: p.region || 'India + global',
      styleId: p.styleId === 'comic' ? 'editorial' : p.styleId,
      design: { ...p.design, grade: 'none', grain: Math.min(p.design.grain, 0.15), music: p.design.music === 'calm' ? 'tense' : p.design.music, showSources: true },
    };
  });
  const writerModels = prefs.writer === 'claude' ? models.claude : models.gemini;
  const writerModel = prefs.writer === 'claude' ? prefs.claudeModel : prefs.geminiModel;
  const pieces = useMemo(() => splitScript(pasted), [pasted]);
  const pastedWords = countWords(pasted);

  const confirmReplace = () =>
    !project.scenes.length
    || window.confirm('This replaces the current ' + project.scenes.length + ' scenes (their pictures and voice clips go with them). Continue?');

  /** What the writer is asked - the same whether it goes to the API or to a chatbot. */
  const storyBody = () => ({
    topic: project.topic, notes, minutes, tone, language: project.language, audience, styleName: styleFor(project.styleId).label, voiceTags,
  });
  const directBody = () => ({
    narrations: pieces, title: project.title, language: project.language, styleName: styleFor(project.styleId).label,
  });

  const write = async () => {
    if (!confirmReplace()) return;
    setBusy('write');
    setError(null);
    try {
      const r = await api.writeStory({ provider: prefs.writer, model: writerModel, ...storyBody() });
      update((p) => applyStory({ ...p, title: '' }, r));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  };

  const usePasted = async (direct: boolean) => {
    if (!pieces.length || !confirmReplace()) return;
    update((p) => ({ ...p, topic: '', scenes: pieces.map((t) => blankScene(t)) }));
    if (!direct) return;
    setBusy('direct');
    setError(null);
    try {
      const r = await api.directScript({ provider: prefs.writer, model: writerModel, ...directBody() });
      update((p) => applyStory(p, r, pieces));
      setPasted('');
    } catch (e) {
      setError((e as Error).message + ' — the script itself is saved; you can plan pictures later on the next step.');
    } finally {
      setBusy('');
    }
  };

  const writerPicker = (
    <>
    <div className="grid">
      <Select
        label="Who writes"
        value={prefs.writer}
        options={[{ id: 'gemini', label: 'Gemini' + (keys.gemini ? '' : ' (no key yet)') }, { id: 'claude', label: 'Claude' + (keys.claude ? '' : ' (no key yet)') }]}
        onChange={(v) => setPrefs((p) => ({ ...p, writer: v as 'gemini' | 'claude' }))}
      />
      <Select
        label="Model"
        value={writerModel}
        options={writerModels.length ? writerModels : [{ id: writerModel, label: writerModel }]}
        onChange={(v) => setPrefs((p) => (p.writer === 'claude' ? { ...p, claudeModel: v } : { ...p, geminiModel: v }))}
      />
    </div>
    <p className="stat" style={{ marginTop: 8 }}>
      {voiceTags
        ? <>🎙 The voice is ElevenLabs v4, so the script comes with a few voice directions like <span className="kbd">[amused]</span> or <span className="kbd">[pause]</span>. They are never shown or spoken as words. Change the voice on the Voice step.</>
        : <>🎙 Voice directions are off: they need an ElevenLabs v4 voice (Voice step).</>}
    </p>
    </>
  );

  return (
    <div className="panel">
      <h2>The story</h2>
      <p className="lede">
        {news ? 'A news explainer: researched live, sourced, dated, and fair to every side.' : 'Let AI write the script from a topic, or paste one she has written herself.'}
      </p>

      <div className="seg kind-seg">
        <button className={!news ? 'on' : ''} onClick={() => setKind('history')}>📜 History</button>
        <button className={news ? 'on' : ''} onClick={() => setKind('news')}>📰 News explainer</button>
      </div>

      {news ? (
        <NewsStory confirmReplace={confirmReplace} writerPicker={writerPicker} languages={LANGUAGES} />
      ) : (
      <>
      <div className="seg">
        <button className={mode === 'ai' ? 'on' : ''} onClick={() => setMode('ai')}>✨ AI writes it</button>
        <button className={mode === 'own' ? 'on' : ''} onClick={() => setMode('own')}>✍️ I have my own script</button>
      </div>

      <div className="grid">
        <Select label="Narration language" value={project.language} options={LANGUAGES} onChange={(v) => update((p) => ({ ...p, language: v }))} />
        <TextInput label="Video title" value={project.title} placeholder={mode === 'ai' ? 'Suggested by the writer' : 'Optional'} onChange={(v) => update((p) => ({ ...p, title: v }))} />
      </div>

      {mode === 'ai' ? (
        <>
          <div className="section-title" style={{ marginTop: 22 }}>Topic</div>
          <TextInput
            label="What curious little piece of history?"
            value={project.topic}
            placeholder="How did ancient Egyptians survive 50°C heat without electricity?"
            onChange={(v) => update((p) => ({ ...p, topic: v }))}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {IDEAS.map((idea) => (
              <button key={idea} className="btn small ghost" onClick={() => update((p) => ({ ...p, topic: idea }))}>{idea}</button>
            ))}
          </div>
          <div style={{ marginTop: 14 }}>
            <TextArea
              label="Angle, facts to include, things to avoid (optional)"
              value={notes}
              onChange={setNotes}
              rows={2}
              placeholder="e.g. Focus on ordinary families, not pharaohs. Mention wind catchers and wet reed mats."
            />
          </div>

          <div className="section-title" style={{ marginTop: 22 }}>Voice of the script</div>
          <div className="tiles">
            {TONES.map((t) => (
              <button key={t.id} className={'tile' + (tone === t.id ? ' active' : '')} onClick={() => setTone(t.id)}>
                <div className="t">{t.t}</div>
                <div className="s">{t.s}</div>
              </button>
            ))}
          </div>

          <div className="grid" style={{ marginTop: 16 }}>
            <Slider label="Length" value={minutes} min={1} max={15} step={1} suffix=" min" onChange={setMinutes}
              hint={'About ' + minutes * WORDS_PER_MINUTE + ' words, ' + Math.round((minutes * WORDS_PER_MINUTE) / 30) + ' scenes.'} />
            <TextInput label="Audience (optional)" value={audience} onChange={setAudience} placeholder="curious adults, no prior knowledge" />
          </div>
          <div style={{ marginTop: 16 }}>{writerPicker}</div>

          <ErrorNote error={error} />
          {!writerKey ? <Note kind="warn">No {prefs.writer === 'claude' ? 'Claude' : 'Gemini'} key — use any chatbot below (free in the Gemini app), add a key on the Keys step, or switch to “I have my own script”.</Note> : null}
          <div className="actions">
            <button className="btn primary big" disabled={!writerKey || !project.topic.trim() || Boolean(busy)} onClick={write}>
              {busy === 'write' ? <><Spinner /> Writing… a long script takes a minute or two</> : project.scenes.length ? '↻ Write a new script' : '✨ Write the script'}
            </button>
          </div>
          {project.topic.trim() ? (
            <ChatbotHelper<StoryResult>
              task="story"
              body={storyBody}
              label={writerKey ? 'Out of API credits? Write it with any chatbot (Gemini app, ChatGPT, Claude)' : 'Write it with any chatbot (Gemini app, ChatGPT, Claude) — no key needed'}
              onResult={(r) => { if (confirmReplace()) update((p) => applyStory({ ...p, title: '' }, r)); }}
            />
          ) : null}
        </>
      ) : (
        <>
          <div className="section-title" style={{ marginTop: 22 }}>Her script</div>
          <Field
            label="Paste the whole script"
            hint="Leave a blank line wherever a new picture should start. Long paragraphs are split at sentence ends automatically; headings and [stage directions] are ignored."
          >
            <textarea rows={14} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder={'You wake up and the air is already trying to kill you…\n\nYet thousands of years ago, whole cities lived through summers like this…'} />
          </Field>
          {pieces.length ? (
            <p className="stat" style={{ marginTop: 8 }}>
              <b>{pieces.length}</b> scenes · <b>{pastedWords}</b> words · about <b>{formatDuration((pastedWords / WORDS_PER_MINUTE) * 60)}</b> spoken
            </p>
          ) : null}
          <div style={{ marginTop: 12 }}>{writerPicker}</div>
          <ErrorNote error={error} />
          <div className="actions">
            <button className="btn primary" disabled={!pieces.length || Boolean(busy) || !writerKey} onClick={() => usePasted(true)}
              title={writerKey ? '' : 'Needs a Gemini or Claude key'}>
              {busy === 'direct' ? <><Spinner /> Planning pictures…</> : '✨ Use script + let AI plan the pictures'}
            </button>
            <button className="btn" disabled={!pieces.length || Boolean(busy)} onClick={() => usePasted(false)}>Use script, I’ll describe pictures myself</button>
          </div>
          <p className="stat" style={{ marginTop: 10 }}>Her words are never changed — AI only suggests what each picture should show.</p>
          {pieces.length ? (
            <ChatbotHelper<StoryResult>
              task="direct"
              body={directBody}
              label="Plan the pictures with any chatbot instead (no key needed)"
              onResult={(r) => {
                if (!confirmReplace()) return;
                update((p) => applyStory({ ...p, topic: '', scenes: pieces.map((t) => blankScene(t)) }, r, pieces));
                setPasted('');
              }}
            />
          ) : null}
        </>
      )}
      </>
      )}

      <div className="section-title" style={{ marginTop: 28 }}>Look of the pictures</div>
      <div className="tiles">
        {ART_STYLES.map((s) => (
          <button key={s.id} className={'tile' + (project.styleId === s.id ? ' active' : '')} onClick={() => update((p) => ({ ...p, styleId: s.id }))}>
            <div className="t">{s.label}</div>
          </button>
        ))}
      </div>
      {news ? null : <div style={{ marginTop: 14 }}>
        <TextArea
          label="Recurring cast & setting (the “style bible”)"
          hint="Added to every picture prompt so the same people appear throughout. The writer fills this in; edit freely."
          value={project.styleBible}
          rows={3}
          onChange={(v) => update((p) => ({ ...p, styleBible: v }))}
          placeholder="Neferu, a 10-year-old Egyptian girl with a short black bob and a white linen dress; her father Ahmose, a potter with a shaved head… Setting: a mud-brick village beside the Nile, 1500 BC. Warm ochre and turquoise palette."
        />
      </div>}

      {project.scenes.length && !news ? (
        <>
          {project.publish.factNotes.length ? (
            <Note kind="warn" title="Worth double-checking before publishing">
              <ul className="facts">{project.publish.factNotes.map((f, i) => <li key={i}>{f}</li>)}</ul>
            </Note>
          ) : null}
          <div className="actions">
            <span className="stat" style={{ alignSelf: 'center' }}><b>{project.scenes.length}</b> scenes ready</span>
            <div className="spacer" />
            <button className="btn primary" onClick={() => goStep(2)}>Next: scenes & pictures →</button>
          </div>
        </>
      ) : null}
    </div>
  );
};
