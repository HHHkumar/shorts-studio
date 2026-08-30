import React, { useState } from 'react';
import {
  api,
  DIAGRAM_DENSITIES,
  DIFFICULTIES,
  ELECTRICAL_SUBJECTS,
  EXAMS,
  INTRO_PRESETS,
  FLAVOURS,
  LANGUAGES,
  LEVELS,
  SUBJECTS,
  TONES,
  type TopicForm,
} from '../lib/api';
import type { ContentType } from '../lib/api';
import { subtopicsFor } from '../lib/subtopics';
import { TrendingPanel } from './TrendingPanel';
import type { DesignSettings, Orientation, QuizContent } from '../lib/types';
import { ErrorNote, Note, Select, Slider, Spinner, TextArea, TextInput } from './controls';

const CURIOSITY_WORDS = [
  'Plain textbook question',
  'Plain textbook question',
  'Plain textbook question',
  'Straightforward, mild interest',
  'A familiar idea with a twist',
  'A familiar idea with a twist',
  'Genuinely interesting',
  'Counter-intuitive result',
  'Counter-intuitive result',
  'Mind-bending',
  'Wait… WHAT?',
];

export const StepTopic: React.FC<{
  form: TopicForm;
  setForm: (updater: (prev: TopicForm) => TopicForm) => void;
  geminiKey: string;
  geminiModel: string;
  setGeminiModel: (v: string) => void;
  geminiModels: { id: string; label: string }[];
  design: DesignSettings;
  setDesign: (updater: (prev: DesignSettings) => DesignSettings) => void;
  onGenerated: (content: QuizContent) => void;
  onBack: () => void;
}> = ({
  form,
  setForm,
  geminiKey,
  geminiModel,
  setGeminiModel,
  geminiModels,
  design,
  setDesign,
  onGenerated,
  onBack,
}) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof TopicForm>(key: K) => (value: TopicForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const landscape = design.orientation === 'landscape';

  // Suggestions follow the chosen subject, in either mode.
  const subtopics = subtopicsFor(form.subject);
  const examMode = form.contentType === 'electrical';

  // Switching mode swaps the subject list, so the old subject would be orphaned.
  const setContentType = (type: ContentType) =>
    setForm((prev) => ({
      ...prev,
      contentType: type,
      subject: type === 'electrical' ? ELECTRICAL_SUBJECTS[2] : SUBJECTS[0],
    }));

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      // The format decides the whole length budget, so it travels with the form.
      const { content } = await api.generate(geminiKey.trim(), geminiModel, {
        ...form,
        orientation: design.orientation,
      });
      onGenerated(content);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel">
      <h2>Step 2 — What should the video be about?</h2>
      <p className="lede">
        Set the dials, press the button, and Gemini writes the question, the four options, the
        explanation and the exact words the voice will say.
      </p>

      <div className="section-title">What kind of video</div>
      <div className="tiles" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <button
          className={'tile' + (!examMode ? ' active' : '')}
          onClick={() => setContentType('general')}
        >
          <div className="t">🔭 Curiosity STEM</div>
          <div className="s">Counter-intuitive science for a general audience. Built to be shared.</div>
        </button>
        <button
          className={'tile' + (examMode ? ' active' : '')}
          onClick={() => setContentType('electrical')}
        >
          <div className="t">⚡ Electrical exam prep</div>
          <div className="s">Questions in the style of a real paper, for candidates revising.</div>
        </button>
      </div>

      <div className="section-title">Format</div>
      <div className="tiles" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {(['portrait', 'landscape'] as Orientation[]).map((o) => (
          <button
            key={o}
            className={'tile' + (design.orientation === o ? ' active' : '')}
            onClick={() => {
              setDesign((prev) => ({ ...prev, orientation: o }));
              // Keep the length inside the range that suits the shape.
              setForm((prev) => ({
                ...prev,
                targetSeconds:
                  o === 'landscape'
                    ? Math.max(180, prev.targetSeconds)
                    : Math.min(90, Math.max(30, prev.targetSeconds)),
              }));
            }}
          >
            <div className="t">{o === 'portrait' ? '📱 Portrait 9:16' : '🖥️ Landscape 16:9'}</div>
            <div className="s">
              {o === 'portrait'
                ? 'Shorts, Reels and TikTok. 30 to 90 seconds.'
                : 'A real explainer for YouTube proper. 2 to 5 minutes.'}
            </div>
          </button>
        ))}
      </div>

      <div className="section-title">The basics</div>
      <div className="grid">
        <Select
          label="Subject"
          value={form.subject}
          options={examMode ? ELECTRICAL_SUBJECTS : SUBJECTS}
          onChange={set('subject')}
        />
        {/* A real dropdown, not a datalist: a datalist shows no arrow, and once
            the box has text it filters itself down to nothing. */}
        <Select
          label={'Sub-topic' + (subtopics.length ? ' — ' + subtopics.length + ' in this area' : '')}
          value={subtopics.includes(form.topic) ? form.topic : ''}
          options={[
            { id: '', label: subtopics.length ? 'Any — let Gemini choose' : 'No sub-topics for this subject' },
            ...subtopics.map((t) => ({ id: t, label: t })),
          ]}
          onChange={set('topic')}
          hint="Concentrate a run of videos on one section, or leave it on Any."
        />
        <TextInput
          label="Or type your own topic"
          value={form.topic}
          onChange={set('topic')}
          placeholder={examMode ? 'e.g. transformer efficiency, ACSR conductors' : 'e.g. black holes, titration, prime numbers'}
          hint="Whatever is in this box is what gets used. Clear it to let Gemini choose."
        />
        {examMode ? (
          <Select
            label="Exam"
            value={form.exam || EXAMS[0]}
            options={EXAMS}
            onChange={set('exam')}
            hint="Sets the depth and the style of question. GATE and ESE go deep; SSC, RRB and ITI stay quick."
          />
        ) : (
          <Select label="Who is watching?" value={form.level} options={LEVELS} onChange={set('level')} />
        )}
        <Select label="Difficulty" value={form.difficulty} options={DIFFICULTIES} onChange={set('difficulty')} />
        <Select
          label="Question style"
          value={form.flavour}
          options={FLAVOURS}
          onChange={set('flavour')}
          hint="Mathematical = the viewer must calculate. Theoretical = the viewer must reason."
        />
        <Select label="Narration language" value={form.language} options={LANGUAGES} onChange={set('language')} />
      </div>

      <div className="section-title">The feel</div>
      <div className="grid">
        <Slider
          label="Curiosity factor"
          value={form.curiosity}
          min={1}
          max={10}
          step={1}
          onChange={set('curiosity')}
          hint={CURIOSITY_WORDS[form.curiosity] + '. Higher means a more surprising, more shareable question.'}
        />
        <Slider
          label="Target length"
          value={form.targetSeconds}
          min={landscape ? 120 : 30}
          max={landscape ? 300 : 90}
          step={landscape ? 15 : 5}
          suffix="s"
          onChange={set('targetSeconds')}
          hint={
            landscape
              ? 'A real explainer with an arc: setup, mechanism, worked example, misconception. 180–240s is the sweet spot.'
              : 'Roughly how long the finished video runs. 40–50s works best for Shorts; below about 40s there is no room to explain anything.'
          }
        />
        <Select label="Tone of voice" value={form.tone} options={TONES} onChange={set('tone')} />
        <Select
          label="How many diagrams"
          value={form.diagramDensity || 'rich'}
          options={DIAGRAM_DENSITIES}
          onChange={(v) => set('diagramDensity')(v as 'sparse' | 'balanced' | 'rich')}
          hint="Charts, circuits and animations drawn into the video. Rich puts one on nearly every scene."
        />
        <Select
          label="Gemini model"
          value={geminiModel}
          options={geminiModels}
          onChange={setGeminiModel}
          hint="Flash is fast and cheap. Pro is smarter for hard maths."
        />
      </div>

      <div className="section-title">Curiosity high — what is trending now</div>
      <p style={{ color: 'var(--dim)', fontSize: 14, marginTop: -4, marginBottom: 12 }}>
        Searches the live web for what people are actually talking about, and judges which of it
        would make a good video. Pick one and it fills the topic box above.
      </p>
      <TrendingPanel
        form={form}
        geminiKey={geminiKey}
        geminiModel={geminiModel}
        onPick={(topic) => set('topic')(topic)}
      />

      <div className="section-title">Your intro (optional)</div>
      <TextInput
        label="Greeting spoken at the very start"
        value={form.intro}
        onChange={set('intro')}
        placeholder="Hi, it's Hemanth here. Ready for today's question?"
        hint="Leave empty to jump straight into the hook. Whatever you write here is spoken and shown word for word — Gemini never rewrites it."
      />
      <div className="actions" style={{ marginTop: 10 }}>
        {INTRO_PRESETS.map((preset) => (
          <button
            key={preset}
            className="btn ghost"
            style={{ fontSize: 13, padding: '8px 14px', fontWeight: 500 }}
            onClick={() => set('intro')(preset)}
          >
            {preset.length > 42 ? preset.slice(0, 40) + '…' : preset}
          </button>
        ))}
        {form.intro ? (
          <button className="btn ghost" style={{ fontSize: 13, padding: '8px 14px' }} onClick={() => set('intro')('')}>
            Clear
          </button>
        ) : null}
      </div>

      <details className="help">
        <summary>Advanced (optional)</summary>
        <div className="inner">
          <div className="grid full" style={{ marginTop: 12 }}>
            <TextArea
              label="Topics to avoid"
              value={form.avoid}
              onChange={set('avoid')}
              rows={2}
              placeholder="e.g. nothing about relativity, no chemistry equations"
            />
            <TextArea
              label="Extra instructions for Gemini"
              value={form.extra}
              onChange={set('extra')}
              rows={2}
              placeholder="e.g. use an Indian everyday example; mention the year it was discovered"
            />
          </div>
        </div>
      </details>

      <ErrorNote error={error} />

      {busy ? (
        <Note kind="info" title="Writing your video…">
          Gemini is inventing the question and the script. This usually takes 5–20 seconds.
        </Note>
      ) : null}

      <div className="actions">
        <button className="btn ghost" onClick={onBack} disabled={busy}>
          ← Back
        </button>
        <div className="spacer" />
        <button className="btn primary big" style={{ width: 'auto' }} onClick={generate} disabled={busy}>
          {busy ? <Spinner /> : '✨'} Generate the question
        </button>
      </div>
    </div>
  );
};
