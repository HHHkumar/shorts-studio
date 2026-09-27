import React, { useEffect, useRef, useState } from 'react';
import { api, EXAMS, type Plan, type PlanItem, type TopicForm, type VoiceSettings } from '../lib/api';
import type { DesignSettings } from '../lib/types';
import { makeVideo, type PipelineResult, type PipelineStage } from '../lib/pipeline';
import { Check, ErrorNote, Note, Select, Spinner, TextInput } from './controls';

// ---------------------------------------------------------------------------
// The planner, and the batch runner that works through it.
//
// Plan: Gemini lays out an exam's syllabus and picks a run of questions
// across it, never one already in the library (server/planner.mjs). Free.
//
// Make: one at a time by hand - the item fills the Topic step - or a whole
// selection in a batch, each video written, checked, carded, voiced and
// rendered with nobody pressing anything (lib/pipeline.ts). A batch stops
// short on any video whose answer DeepSeek disputes, and leaves it in the
// library to look at. It runs in this tab: keep it open, and the computer
// awake, until it finishes.
// ---------------------------------------------------------------------------

const STAGE_LABEL: Record<PipelineStage, string> = {
  write: 'Writing',
  check: 'Checking the answer',
  formulas: 'Formula card',
  engineer: 'Directing the engineer',
  pictures: 'Drawing',
  voice: 'Voice',
  render: 'Rendering',
};

type Row = { stage?: string; result?: PipelineResult };

export const PlannerView: React.FC<{
  geminiKey: string;
  geminiModel: string;
  elevenKey: string;
  deepseekKey: string;
  deepseekModel: string;
  form: TopicForm;
  design: DesignSettings;
  voice: VoiceSettings;
  /** Make one by hand: fill the Topic step with it. */
  onMakeByHand: (plan: Plan, item: PlanItem) => void;
  onOpenVideo: (videoId: string) => void;
  onClose: () => void;
}> = ({ geminiKey, geminiModel, elevenKey, deepseekKey, deepseekModel, form, design, voice, onMakeByHand, onOpenVideo, onClose }) => {
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [planId, setPlanId] = useState('');
  const [exam, setExam] = useState(form.exam || EXAMS[0]);
  const [focus, setFocus] = useState('');
  const [count, setCount] = useState('20');
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawPictures, setDrawPictures] = useState(false);
  const [quality, setQuality] = useState('medium');
  const [running, setRunning] = useState(false);
  const [rows, setRows] = useState<Record<string, Row>>({});
  const stop = useRef(false);

  const load = () => api.plans()
    .then((r) => {
      setPlans(r.plans);
      if (!planId && r.plans.length) setPlanId(r.plans[0].id);
    })
    .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const plan = (plans || []).find((p) => p.id === planId) || null;
  const noGemini = geminiKey.trim().length < 6;

  const makePlan = async () => {
    setPlanning(true);
    setError(null);
    try {
      const { plan: p } = await api.makePlan({ apiKey: geminiKey, model: geminiModel, exam, focus, count: Number(count) || 20 });
      await load();
      setPlanId(p.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPlanning(false);
    }
  };

  const setStatus = async (item: PlanItem, status: PlanItem['status'], videoId?: string) => {
    if (!plan) return;
    const { plan: p } = await api.updatePlanItem(plan.id, item.id, { status, ...(videoId ? { videoId } : {}) });
    setPlans((list) => (list || []).map((x) => (x.id === p.id ? p : x)));
  };

  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const batchBlocker = noGemini ? 'Add your Gemini key on the Keys step.'
    : elevenKey.trim().length < 6 ? 'Add your ElevenLabs key on the Keys step.'
      : !voice.voiceId ? 'Choose a voice on the Voice step first - every video in the batch uses it.'
        : '';

  const runBatch = async () => {
    if (!plan) return;
    const items = plan.items.filter((i) => selected.has(i.id));
    stop.current = false;
    setRunning(true);
    setError(null);
    for (const item of items) {
      if (stop.current) break;
      setRows((r) => ({ ...r, [item.id]: { stage: 'Starting' } }));
      const result = await makeVideo(
        { exam: plan.exam, subject: item.subject, topic: item.topic, angle: item.angle, difficulty: item.difficulty },
        { geminiKey, geminiModel, elevenKey, deepseekKey, deepseekModel, form, design, voice, quality, drawPictures },
        (stage, detail) => setRows((r) => ({ ...r, [item.id]: { stage: STAGE_LABEL[stage] + (detail ? ' - ' + detail : '') } })),
        () => stop.current,
      );
      setRows((r) => ({ ...r, [item.id]: { result } }));
      // Made and rendered: done. Stopped for a look: still to do, with its video linked.
      await setStatus(item, result.status === 'done' ? 'done' : 'todo', result.videoId).catch(() => undefined);
      setSelected((prev) => { const next = new Set(prev); next.delete(item.id); return next; });
    }
    setRunning(false);
  };

  const todo = plan ? plan.items.filter((i) => i.status === 'todo') : [];
  const done = plan ? plan.items.filter((i) => i.status === 'done').length : 0;

  return (
    <div className="panel">
      <h2>Planner</h2>
      <p className="lede">
        A run of questions across an exam&rsquo;s syllabus, never repeating one you have made. Make them one at
        a time, or tick several and let the batch make them — written, checked, voiced and rendered — while you
        do something else.
      </p>
      <ErrorNote error={error} />

      <div className="grid">
        <Select label="Exam" value={exam} options={EXAMS.map((e) => ({ id: e, label: e }))} onChange={setExam} disabled={planning} />
        <TextInput label="Focus (optional)" value={focus} onChange={setFocus} placeholder="e.g. Electrical Machines only" />
        <TextInput label="How many questions" value={count} onChange={setCount} />
      </div>
      <div className="actions">
        <button className="btn primary" onClick={makePlan} disabled={planning || noGemini}>
          {planning ? <><Spinner /> Planning…</> : plan && plan.exam === exam ? 'Plan more for ' + exam : 'Plan ' + (Number(count) || 20) + ' questions'}
        </button>
        <span className="hint">Free tier. Topics already in your library are left out.</span>
        <span className="spacer" />
        <button className="btn ghost" onClick={onClose}>Back to the video</button>
      </div>

      {plans && plans.length > 1 ? (
        <div className="plan-tabs">
          {plans.map((p) => (
            <button key={p.id} className={'btn small' + (p.id === planId ? ' primary' : ' ghost')} onClick={() => setPlanId(p.id)}>
              {p.exam} ({p.items.filter((i) => i.status === 'done').length}/{p.items.length})
            </button>
          ))}
        </div>
      ) : null}

      {plans === null ? <p className="hint"><Spinner /> Reading your plans…</p> : null}

      {plan ? (
        <>
          <div className="section-title">{plan.exam} — {done} of {plan.items.length} made</div>
          {plan.syllabus.length ? (
            <details className="help">
              <summary>The syllabus, as planned ({plan.syllabus.length} units)</summary>
              <div className="inner">
                {plan.syllabus.map((u) => <div key={u.unit}><b>{u.unit}</b>: {u.topics.join(', ')}</div>)}
              </div>
            </details>
          ) : null}

          <div className="plan-list">
            {plan.items.map((item) => {
              const row = rows[item.id];
              return (
                <div key={item.id} className={'plan-row ' + item.status}>
                  <input
                    type="checkbox"
                    checked={selected.has(item.id)}
                    disabled={item.status !== 'todo' || running}
                    onChange={() => toggle(item.id)}
                    title="Include in the batch"
                  />
                  <div className="plan-main">
                    <div><b>{item.topic}</b> <span className="hint">· {item.subject} · {item.difficulty}</span></div>
                    <div className="hint">{item.angle}</div>
                    {row && row.stage ? <div className="hint"><Spinner /> {row.stage}</div> : null}
                    {row && row.result ? (
                      <div className={'hint plan-result ' + row.result.status}>
                        {row.result.status === 'done' ? '✓ Made and rendered.' : row.result.status === 'review' ? '⚠ ' + row.result.note : '✗ ' + row.result.note}
                      </div>
                    ) : null}
                  </div>
                  <div className="plan-actions">
                    {item.videoId ? <button className="btn small" onClick={() => onOpenVideo(item.videoId)}>Open</button> : null}
                    {item.status === 'todo' ? (
                      <>
                        <button className="btn small ghost" disabled={running} onClick={() => onMakeByHand(plan, item)}>Make by hand</button>
                        <button className="btn small ghost" disabled={running} onClick={() => setStatus(item, 'skipped')} title="Skip this one">Skip</button>
                      </>
                    ) : (
                      <button className="btn small ghost" disabled={running} onClick={() => setStatus(item, 'todo')} title="Back on the list">Undo</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="section-title">Make several at once</div>
          <Check
            label="Draw what stands beside the engineer"
            hint="Doodle look only: about 4c a picture, two or three a video. Off, he appears on his own, for free."
            checked={drawPictures}
            onChange={setDrawPictures}
          />
          <div className="grid">
            <Select
              label="Quality"
              value={quality}
              options={[{ id: 'medium', label: 'Normal (recommended)' }, { id: 'high', label: 'High' }, { id: 'low', label: 'Draft' }]}
              onChange={setQuality}
            />
          </div>
          {batchBlocker ? <Note kind="warn" title="Not ready to run a batch">{batchBlocker}</Note> : (
            <Note kind="info" title="Before you start">
              Each video uses this look ({design.layout}, {design.orientation}), this voice ({voice.voiceName || voice.voiceId}), and
              your topic settings. About 500–900 voice characters each. It runs in this tab — keep it open and the computer awake.
              {deepseekKey.trim() ? ' A video DeepSeek disputes is stopped before its voice, for you to check.' : ' Add a DeepSeek key to have every answer checked first.'}
            </Note>
          )}
          <div className="actions">
            {running ? (
              <button className="btn danger" onClick={() => { stop.current = true; }}>Stop after this video</button>
            ) : (
              <button className="btn primary" disabled={!selected.size || Boolean(batchBlocker)} onClick={runBatch}>
                Make {selected.size || ''} video{selected.size === 1 ? '' : 's'}
              </button>
            )}
            {!running && todo.length ? (
              <button className="btn ghost" onClick={() => setSelected(new Set(todo.slice(0, 5).map((i) => i.id)))}>Select the next 5</button>
            ) : null}
          </div>
        </>
      ) : plans && !plans.length ? (
        <Note kind="info" title="No plan yet">Choose an exam and press Plan.</Note>
      ) : null}
    </div>
  );
};
