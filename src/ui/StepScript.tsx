import React, { useState } from 'react';
import {
  api,
  contentFingerprint,
  type TopicForm,
  type ValidationReport,
} from '../lib/api';
import type { QuizContent, ScriptLine } from '../lib/types';
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
  const totalSeconds = content.script.reduce((sum, s) => sum + estimateSeconds(s.narration), 0);

  // A script that came out far under target is worth catching here, while
  // regenerating is still free - after step 4 it has cost voice credits.
  const lengthGap = form.targetSeconds > 0 && totalSeconds < form.targetSeconds * 0.75;

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
      <h2>Step 3 — Check what Gemini wrote</h2>
      <p className="lede">
        Everything below is editable. Fix anything that looks wrong <b>now</b>, before you spend voice
        credits on it. If it all looks good, just press Continue.
      </p>

      <div className="section-title">Second opinion</div>
      {!deepseekKey.trim() ? (
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

      <div className="section-title">The question</div>
      <div className="qa-card">
        <div className="field" style={{ marginBottom: 14 }}>
          <label>Question</label>
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

        <div className="field" style={{ marginTop: 14 }}>
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
            <span className="kind">{line.kind}</span>
            <span style={{ fontSize: 13, color: 'var(--dim)' }}>{KIND_HELP[line.kind] || ''}</span>
            <span className="len">~{estimateSeconds(line.narration)}s</span>
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
            <div className="field">
              <label>📺 Big text on screen</label>
              <input
                type="text"
                value={line.onScreen}
                onChange={(e) => setScriptLine(i, { onScreen: e.target.value }, false)}
              />
              <div className="hint">Keep it under about 12 words or it will be shrunk to fit.</div>
            </div>
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

      <div className="actions">
        <button className="btn ghost" onClick={onBack}>
          ← Write a different question
        </button>
        <div className="spacer" />
        <button className="btn primary" onClick={onNext}>
          Looks good, add a voice →
        </button>
      </div>
    </div>
  );
};
