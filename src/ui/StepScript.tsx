import React, { useState } from 'react';
import {
  api,
  contentFingerprint,
  type TopicForm,
  type ValidationReport,
} from '../lib/api';
import type { QuizContent, ScenePanel, SceneKind, ScriptLine } from '../lib/types';
import { missingLabels } from '../lib/options-timing';
import { scriptSeconds } from '../lib/blank-script';
import { ErrorNote, Note, Select, Spinner } from './controls';

const LETTERS = ['A', 'B', 'C', 'D'];

const KIND_HELP: Record<string, string> = {
  hook: 'The first 2 seconds. This is what stops the scroll.',
  question: 'The question is read out and shown big.',
  options: 'The four choices slide in one by one.',
  countdown: 'A silent ticking timer so the viewer can think. Narration here is optional.',
  answer: 'The correct option lights up green.',
  explain: 'One idea per card. Keep each one short.',
  outro: 'The fun fact and the call to action.',
  title: 'A title card naming the question the video answers.',
  metaphor: 'Something familiar on the left, the real thing on the right.',
  diagram: 'Boxes and arrows. They appear as the narration reaches each one.',
  process: 'Steps in order, with the highlight travelling along them.',
  versus: 'Two things side by side, revealed point against point.',
  timeline: 'Dated entries down a spine.',
  grid: 'Several equal things, each with a symbol.',
  recap: 'The takeaways, ticking in one at a time.',
};

/** Which scene kinds carry a drawn layout rather than plain narration. */
const PANEL_KINDS = new Set([
  'title', 'metaphor', 'diagram', 'process', 'versus', 'timeline', 'grid', 'recap',
]);

/** Everything drawn on this scene, in the order the narration should cover it. */
function panelLabels(panel: ScenePanel | undefined): string[] {
  if (!panel) return [];
  const out: string[] = [];
  if (panel.leftLabel) out.push(panel.leftLabel);
  if (panel.rightLabel) out.push(panel.rightLabel);
  (panel.nodes || []).forEach((n) => out.push(n.label));
  (panel.steps || []).forEach((st) => out.push(st.label));
  return out.filter(Boolean);
}

/**
 * A read-only look at what the scene draws, plus the one thing a director can
 * break by rewriting narration: a label the voice no longer says can only be
 * revealed on a guess, so it is called out here rather than discovered later.
 */
const PanelSummary: React.FC<{ line: ScriptLine }> = ({ line }) => {
  const labels = panelLabels(line.panel);
  if (!labels.length) return null;
  const missing = new Set(missingLabels(line.narration, labels));

  return (
    <div className="field">
      <label>🖼️ Drawn on screen</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {labels.map((label, i) => (
          <span
            key={i}
            title={missing.has(label) ? 'The narration never says this, so it cannot be timed to the voice.' : 'Timed to the voice.'}
            style={{
              padding: '5px 11px',
              borderRadius: 999,
              fontSize: 13.5,
              border: '1px solid ' + (missing.has(label) ? 'var(--warn, #d18b2c)' : 'var(--line)'),
              color: missing.has(label) ? 'var(--warn, #d18b2c)' : 'var(--dim)',
            }}
          >
            {missing.has(label) ? '⚠ ' : ''}
            {label}
          </span>
        ))}
      </div>
      {missing.size ? (
        <div className="hint">
          The marked labels are not spoken in this scene, so they will appear on a guess rather than
          on the voice. Mention them in the narration above, in the order shown.
        </div>
      ) : (
        <div className="hint">Each of these appears as the narration reaches it.</div>
      )}
    </div>
  );
};

const estimateSeconds = (text: string): number => {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.round((words / 2.6) * 10) / 10;
};

const VERDICT_STYLE: Record<string, { kind: 'good' | 'warn' | 'error'; icon: string; title: string }> = {
  pass: { kind: 'good', icon: '✅', title: 'DeepSeek agrees' },
  warn: { kind: 'warn', icon: '⚠️', title: 'DeepSeek has reservations' },
  fail: { kind: 'error', icon: '❌', title: 'DeepSeek disagrees' },
};

const ReportCard: React.FC<{ report: ValidationReport; onApply: () => void }> = ({ report, onApply }) => {
  const style = VERDICT_STYLE[report.verdict] || VERDICT_STYLE.warn;
  const disagrees = report.agrees === false && report.correctIndex >= 0;

  return (
    <Note kind={style.kind} title={style.icon + '  ' + style.title}>
      <div style={{ marginBottom: disagrees || report.issues.length ? 10 : 0 }}>
        {report.summary}
        {report.confidence > 0 ? (
          <span style={{ color: 'var(--dim)' }}> · {report.confidence}% confident</span>
        ) : null}
      </div>

      {disagrees ? (
        <div className="verdict-swap">
          <div>
            Gemini marked <b style={{ display: 'inline' }}>{LETTERS[report.markedIndex]}</b>. DeepSeek
            solved it and got <b style={{ display: 'inline' }}>{LETTERS[report.correctIndex]}</b>.
            <div style={{ fontSize: 13, color: 'var(--dim)', marginTop: 4 }}>
              One of them is wrong. Read the reasoning below and decide for yourself — do not just
              take DeepSeek's word for it either.
            </div>
          </div>
          <button className="btn" onClick={onApply}>
            Mark {LETTERS[report.correctIndex]} correct
          </button>
        </div>
      ) : null}

      {report.issues.length ? (
        <ul className="issues">
          {report.issues.map((issue, i) => (
            <li key={i} className={'sev-' + issue.severity}>
              <span className="sev">{issue.severity}</span>
              <span className="where">{issue.where}</span>
              <span>
                {issue.problem}
                {issue.fix ? <em style={{ color: 'var(--dim)' }}> → {issue.fix}</em> : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {report.reasoning ? (
        <details className="help" style={{ marginTop: 10 }}>
          <summary>How DeepSeek worked it out</summary>
          <div className="inner">{report.reasoning}</div>
        </details>
      ) : null}
    </Note>
  );
};

/**
 * How much has been written against how much was asked for.
 *
 * Deliberately a reading of the words, not a promise about the video: a scene
 * lasts exactly as long as its recorded narration, so the real length only
 * exists once the voice has been made. This is the same 2.6 words a second the
 * generator budgets with, which makes it a good guide and not a guarantee.
 */
const LengthMeter: React.FC<{ written: number; target: number }> = ({ written, target }) => {
  if (!target) return null;
  const ratio = written / target;
  const pct = Math.min(100, Math.round(ratio * 100));
  const tone = ratio < 0.7 ? 'var(--warn, #d18b2c)' : ratio > 1.3 ? 'var(--warn, #d18b2c)' : 'var(--good)';

  return (
    <div style={{ margin: '0 0 14px' }}>
      <div
        style={{
          height: 8,
          borderRadius: 999,
          background: 'var(--line)',
          overflow: 'hidden',
        }}
      >
        <div style={{ width: pct + '%', height: '100%', background: tone }} />
      </div>
      <div style={{ marginTop: 6, fontSize: 13.5, color: 'var(--dim)' }}>
        About <b style={{ color: tone }}>{Math.round(written)}s</b> written of the {target}s you asked
        for.{' '}
        {ratio < 0.7
          ? 'Short — add scenes or say more in each.'
          : ratio > 1.3
            ? 'Long — trim a little, or raise the target on step 2.'
            : 'That is about right.'}{' '}
        The real length is set by the recorded voice, not by this estimate.
      </div>
    </div>
  );
};

export const StepScript: React.FC<{
  content: QuizContent;
  setContent: (updater: (prev: QuizContent) => QuizContent) => void;
  hasAudio: boolean;
  onEdited: () => void;
  deepseekKey: string;
  deepseekModel: string;
  setDeepseekModel: (v: string) => void;
  deepseekModels: { id: string; label: string }[];
  form: TopicForm;
  report: ValidationReport | null;
  setReport: (r: ValidationReport | null) => void;
  onBack: () => void;
  onNext: () => void;
}> = ({
  content,
  setContent,
  hasAudio,
  onEdited,
  deepseekKey,
  deepseekModel,
  setDeepseekModel,
  deepseekModels,
  form,
  report,
  setReport,
  onBack,
  onNext,
}) => {
  const explainer = content.videoKind === 'explainer';
  const mine = content.handWritten === true;

  /**
   * The kinds worth offering by hand. The panel layouts are not here because a
   * panel is content in its own right and only the generator writes one - but a
   * scene keeps whichever kind it arrived with, so a generated diagram can
   * still be moved or removed without being forced to become something else.
   */
  const KINDS_FOR_HAND: SceneKind[] = explainer
    ? ['intro', 'title', 'explain', 'outro']
    : ['intro', 'hook', 'question', 'options', 'countdown', 'answer', 'explain', 'outro'];

  const kindOptions = (current: SceneKind) => {
    const ids = KINDS_FOR_HAND.includes(current) ? KINDS_FOR_HAND : [current, ...KINDS_FOR_HAND];
    return ids.map((id) => ({ id, label: id }));
  };

  /** Scene edits all rewrite the script, and all of them invalidate the audio. */
  const editScript = (fn: (lines: ScriptLine[]) => ScriptLine[]) =>
    patch((prev) => ({ ...prev, script: fn([...prev.script]) }), true);

  const addScene = () =>
    editScript((lines) => {
      // Before the outro, because the sign-off is always last.
      const at = lines.length && lines[lines.length - 1].kind === 'outro'
        ? lines.length - 1
        : lines.length;
      lines.splice(at, 0, { kind: 'explain', narration: '' });
      return lines;
    });

  const removeScene = (index: number) => editScript((lines) => {
    lines.splice(index, 1);
    return lines;
  });

  const moveScene = (index: number, by: number) => editScript((lines) => {
    const to = index + by;
    if (to < 0 || to >= lines.length) return lines;
    const [moved] = lines.splice(index, 1);
    lines.splice(to, 0, moved);
    return lines;
  });
  const totalSeconds = content.script.reduce((sum, s) => sum + estimateSeconds(s.narration), 0);

  // A script that came out far under target is worth catching here, while
  // regenerating is still free - after step 4 it has cost voice credits.
  const lengthGap = !mine && form.targetSeconds > 0 && totalSeconds < form.targetSeconds * 0.75;

  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);

  // A report is only about the question it was run against.
  const fingerprint = contentFingerprint(content);
  const stale = !!report && report.fingerprint !== fingerprint;
  const fresh = report && !stale ? report : null;

  const runCheck = async () => {
    setChecking(true);
    setCheckError(null);
    try {
      const { report: r } = await api.validate(deepseekKey.trim(), deepseekModel, content, form);
      setReport({ ...r, fingerprint: contentFingerprint(content) });
    } catch (e) {
      setCheckError(e instanceof Error ? e.message : String(e));
    } finally {
      setChecking(false);
    }
  };

  const patch = (fn: (prev: QuizContent) => QuizContent, touchesNarration: boolean) => {
    setContent(fn);
    if (touchesNarration && hasAudio) onEdited();
  };

  const applyDeepseekAnswer = () => {
    if (!fresh || fresh.correctIndex < 0) return;
    const next = fresh.correctIndex;
    patch((p) => ({ ...p, correctIndex: next }), false);
    // The report described the old marking, so it no longer applies to this question.
    setReport(null);
  };

  const setScriptLine = (index: number, changes: Partial<ScriptLine>, touchesNarration: boolean) => {
    patch(
      (prev) => ({
        ...prev,
        script: prev.script.map((line, i) => (i === index ? { ...line, ...changes } : line)),
      }),
      touchesNarration,
    );
  };

  return (
    <div className="panel">
      <h2>Step 3 — {mine ? 'Write your script' : 'Check what Gemini wrote'}</h2>
      <p className="lede">
        {mine
          ? 'Type what the voice should say, one scene at a time. Add, remove and reorder scenes as you like. Nothing here costs anything — the credits are only spent on the next step.'
          : 'Everything below is editable. Fix anything that looks wrong now, before you spend voice credits on it. If it all looks good, just press Continue.'}
      </p>

      {mine ? null : <div className="section-title">Second opinion</div>}
      {mine ? null : explainer ? (
        <Note kind="info" title="Not available on explainers yet">
          The DeepSeek check works by solving the question independently and comparing answers. An
          explainer has no question to solve, so there is nothing for it to disagree with. Checking
          the claims in a storyboard is a different job and is not built yet — read the script below
          yourself, and be especially careful with any number or date.
        </Note>
      ) : !deepseekKey.trim() ? (
        <Note kind="info" title="The answer has not been checked">
          Gemini marked its own answer. Add a <b>DeepSeek key</b> on step 1 and a different model will
          solve the question independently and tell you whether it agrees. It costs a fraction of a
          cent and runs before you spend any voice credits.
        </Note>
      ) : (
        <>
          {fresh ? <ReportCard report={fresh} onApply={applyDeepseekAnswer} /> : null}
          {stale ? (
            <Note kind="warn" title="The check is out of date">
              You have edited the question since DeepSeek looked at it. Run the check again.
            </Note>
          ) : null}
          <ErrorNote error={checkError} />
          <div className="grid" style={{ marginTop: 12, alignItems: 'end' }}>
            <Select
              label="Checking model"
              value={deepseekModel}
              options={deepseekModels}
              onChange={setDeepseekModel}
              hint="Reasoner is slower but much better at catching a wrong calculation."
            />
            <div>
              <button className="btn big" onClick={runCheck} disabled={checking}>
                {checking ? <Spinner /> : '🔍'}{' '}
                {fresh || stale ? 'Check again' : 'Check the answer'}
              </button>
            </div>
          </div>
          {checking ? (
            <Note kind="info">
              DeepSeek is solving the question from scratch. This takes 5–30 seconds, longer with
              Reasoner.
            </Note>
          ) : null}
        </>
      )}

      {hasAudio ? (
        <Note kind="warn" title="You already made a voiceover">
          Changing any <b>spoken narration</b> below means the voiceover has to be recorded again. On-screen
          text and options can be changed freely.
        </Note>
      ) : null}

      <div className="section-title">{explainer ? 'The subject' : 'The question'}</div>
      <div className="qa-card">
        <div className="field" style={{ marginBottom: explainer ? 0 : 14 }}>
          <label>{explainer ? 'The question this video answers' : 'Question'}</label>
          <textarea
            rows={2}
            value={content.question}
            onChange={(e) => patch((p) => ({ ...p, question: e.target.value }), false)}
          />
        </div>

        {content.options.map((opt, i) => (
          <div key={i} className={'opt-row' + (i === content.correctIndex ? ' correct' : '')}>
            <div className="letter">{LETTERS[i]}</div>
            <input
              type="text"
              value={opt}
              onChange={(e) =>
                patch(
                  (p) => ({ ...p, options: p.options.map((o, j) => (j === i ? e.target.value : o)) }),
                  false,
                )
              }
            />
            {i === content.correctIndex ? (
              <span className="pick" style={{ color: 'var(--good)', fontWeight: 700 }}>
                ✓ correct
              </span>
            ) : (
              <button className="pick link-btn" onClick={() => patch((p) => ({ ...p, correctIndex: i }), false)}>
                mark correct
              </button>
            )}
          </div>
        ))}

        <div className="field" style={{ marginTop: 14, display: explainer ? 'none' : undefined }}>
          <label>Fun fact (shown at the end)</label>
          <textarea
            rows={2}
            value={content.funFact}
            onChange={(e) => patch((p) => ({ ...p, funFact: e.target.value }), false)}
          />
        </div>
      </div>

      <div className="section-title">
        The script — {content.script.length} scenes, about {Math.round(totalSeconds)} seconds of speech
      </div>

      <LengthMeter written={scriptSeconds(content.script)} target={form.targetSeconds} />

      {lengthGap ? (
        <Note kind="warn" title={'This is a ' + Math.round(totalSeconds) + ' second script, not ' + form.targetSeconds}>
          Gemini wrote {Math.round((totalSeconds / form.targetSeconds) * 100)}% of the length you asked
          for. Press <b>Write a different question</b> to try again — a second attempt usually lands much
          closer. Switching to a stronger Gemini model also helps on long explainers.
        </Note>
      ) : null}

      {content.script.map((line, i) => (
        <div className="scene" key={i}>
          <div className="scene-head">
            <select
              className="kind-select"
              value={line.kind}
              onChange={(e) => setScriptLine(i, { kind: e.target.value as SceneKind }, true)}
              title="What this scene is for"
            >
              {kindOptions(line.kind).map((k) => (
                <option key={k.id} value={k.id}>{k.label}</option>
              ))}
            </select>
            <span style={{ fontSize: 13, color: 'var(--dim)' }}>{KIND_HELP[line.kind] || ''}</span>
            <span className="len">~{estimateSeconds(line.narration)}s</span>
            <button className="scene-btn" onClick={() => moveScene(i, -1)} disabled={i === 0} title="Move up">
              ↑
            </button>
            <button
              className="scene-btn"
              onClick={() => moveScene(i, 1)}
              disabled={i === content.script.length - 1}
              title="Move down"
            >
              ↓
            </button>
            <button
              className="scene-btn danger"
              onClick={() => removeScene(i)}
              disabled={content.script.length <= 1}
              title="Delete this scene"
            >
              ✕
            </button>
          </div>
          <div className="scene-body">
            <div className="field">
              <label>🎙️ Spoken out loud</label>
              <textarea
                rows={2}
                value={line.narration}
                placeholder={line.kind === 'countdown' ? '(silent — leave empty for a quiet timer)' : ''}
                onChange={(e) => setScriptLine(i, { narration: e.target.value }, true)}
              />
              <div className="hint">Write it exactly as it should sound. No symbols like ^ or *.</div>
            </div>
            {PANEL_KINDS.has(line.kind) ? (
              <PanelSummary line={line} />
            ) : (
              <div className="field">
                <label>📺 Big text on screen</label>
                <input
                  type="text"
                  value={line.onScreen}
                  onChange={(e) => setScriptLine(i, { onScreen: e.target.value }, false)}
                />
                <div className="hint">Keep it under about 12 words or it will be shrunk to fit.</div>
              </div>
            )}
            {line.kind === 'explain' ? (
              <div className="field">
                <label>Supporting lines (one per line, optional)</label>
                <textarea
                  rows={2}
                  value={(line.bullets || []).join('\n')}
                  onChange={(e) =>
                    setScriptLine(
                      i,
                      { bullets: e.target.value.split('\n').map((b) => b.trim()).filter(Boolean).slice(0, 3) },
                      false,
                    )
                  }
                />
              </div>
            ) : null}
          </div>
        </div>
      ))}

      <div className="actions" style={{ marginTop: 4 }}>
        <button className="btn" onClick={addScene}>+ Add a scene</button>
      </div>

      <div className="actions">
        <button className="btn ghost" onClick={onBack}>
          ← {mine ? 'Back to the settings' : explainer ? 'Write a different storyboard' : 'Write a different question'}
        </button>
        <div className="spacer" />
        <button className="btn primary" onClick={onNext}>
          Looks good, add a voice →
        </button>
      </div>
    </div>
  );
};
