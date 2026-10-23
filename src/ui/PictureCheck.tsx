import React, { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import type { QuizContent, VideoProps } from '../lib/types';
import { DEFAULT_DESIGN } from '../lib/theme';
import {
  applyPictureReview, isFlagged, restorePicture, tally, uncheckedPictures, type PictureReview,
} from '../lib/picture-review';
import { ErrorNote, Note, Spinner } from './controls';

// ---------------------------------------------------------------------------
// The picture check, on the Script step.
//
// A wrong diagram is the fault a viewer forgives least, and it is the one a
// creator skimming a script cannot see - the script step shows words. So every
// diagram is read by a reviewer against the line it sits on, as soon as there
// is a script: the frame is rendered, Gemini looks at it, DeepSeek reads it in
// words, and anything either calls wrong or beside the point is taken out.
//
// The person outranks the reviewer. Every picture taken out is listed with the
// reason and a way to put it back.
// ---------------------------------------------------------------------------

const VERDICT: Record<PictureReview['verdict'], { label: string; cls: string }> = {
  right: { label: 'Right', cls: 'ok' },
  unsure: { label: 'Not sure', cls: 'warn' },
  unrelated: { label: 'Beside the point', cls: 'bad' },
  wrong: { label: 'Wrong', cls: 'bad' },
};

export const PictureCheck: React.FC<{
  content: QuizContent;
  setContent: (updater: (prev: QuizContent) => QuizContent) => void;
  videoProps: VideoProps | null;
  /** The library id of this video, so a reported picture lands on its own bench case. */
  videoId?: string;
  geminiKey: string;
  geminiModel: string;
  deepseekKey: string;
  deepseekModel: string;
}> = ({ content, setContent, videoProps, videoId = '', geminiKey, geminiModel, deepseekKey, deepseekModel }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // "Wrong picture": which row is open for a note, the note, and which is being sent.
  const [reporting, setReporting] = useState<string | null>(null);
  const [reportNote, setReportNote] = useState('');
  const [sending, setSending] = useState(false);
  // What has been tried on its own already, so a failed check is not retried in a loop.
  const tried = useRef(new Set<string>());

  const record = content.pictureReview;
  const reviews = record ? record.reviews : [];
  const unchecked = uncheckedPictures(content.script, reviews);
  const canCheck = geminiKey.trim().length > 5 || deepseekKey.trim().length > 5;

  const run = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const sent = content.script;
    try {
      const out = await api.reviewPictures({
        geminiKey: geminiKey.trim(), geminiModel, deepseekKey: deepseekKey.trim(), deepseekModel,
        content, props: videoProps || undefined,
      });
      setContent((prev) => {
        // A picture the person put back stays, whatever the reviewer says again.
        const before = prev.pictureReview ? prev.pictureReview.reviews : [];
        const kept = new Set(before.filter((r) => r.kept).map((r) => r.key));
        // And a picture taken out before is still out, and still listed.
        const gone = before.filter((r) => r.removed && !out.reviews.some((n) => n.key === r.key));
        const applied = applyPictureReview(prev.script, sent, out.reviews.map((r) => (kept.has(r.key) ? { ...r, kept: true } : r)));
        return {
          ...prev,
          script: applied.script,
          pictureReview: {
            checkedAt: new Date().toISOString(),
            by: out.by,
            sawFrames: out.sawFrames,
            reviews: [...applied.reviews, ...gone],
            problems: out.problems,
          },
        };
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  // On its own, once, whenever there is a picture nobody has looked at.
  const signature = unchecked.join(',');
  useEffect(() => {
    if (!signature || busy || !canCheck || tried.current.has(signature)) return;
    tried.current.add(signature);
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, canCheck]);

  const putBack = (key: string) =>
    setContent((prev) => {
      if (!prev.pictureReview) return prev;
      const out = restorePicture(prev.script, prev.pictureReview.reviews, key);
      return { ...prev, script: out.script, pictureReview: { ...prev.pictureReview, reviews: out.reviews } };
    });

  /**
   * The person says a picture is wrong - whatever the reviewers said. It is
   * taken out at once, and kept on the test bench marked wrong by them, so the
   * rules and the reviewer are measured against it from now on. Put it back
   * undoes the first; the mark stays, because it was true when it was made.
   */
  const reportWrong = async (r: PictureReview) => {
    const line = content.script[r.scene];
    if (!line || !line.visual || line.visual.kind === 'none') return;
    setSending(true);
    setError(null);
    const note = reportNote.trim();
    try {
      await api.reportPicture({ videoId, content, design: videoProps ? videoProps.design : DEFAULT_DESIGN, scene: r.scene, note });
      setContent((prev) => {
        const now = prev.script[r.scene];
        if (!now || !now.visual || now.visual.kind === 'none' || !prev.pictureReview) return prev;
        const script = prev.script.slice();
        script[r.scene] = { ...now, visual: { kind: 'none' }, pictureNote: 'Taken out by you: ' + (note || 'marked wrong.') };
        const reviews = prev.pictureReview.reviews.map((x) => (x.key === r.key
          ? { ...x, removed: now.visual, verdict: 'wrong' as const, reason: 'You: ' + (note || 'marked wrong.'), kept: false, reported: true }
          : x));
        return { ...prev, script, pictureReview: { ...prev.pictureReview, reviews } };
      });
      setReporting(null);
      setReportNote('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  };

  // Pictures the rules never let through: said here so a bare scene has a reason.
  const notDrawn = content.script
    .map((line, i) => ({ i, note: line.pictureNote || '', none: !line.visual || line.visual.kind === 'none' }))
    .filter((x) => x.note && x.none && !/^Taken out by (the picture check|you)/.test(x.note));

  const shown = reviews.slice().sort((a, b) => a.scene - b.scene);
  const t = tally(shown);
  const out = shown.filter((r) => r.removed).length;
  const nothing = !shown.length && !notDrawn.length && !unchecked.length;

  return (
    <div className="picture-check">
      <div className="section-title">Picture check</div>
      {nothing ? (
        <p className="hint" style={{ marginTop: 0 }}>
          This script has no diagrams that state anything, so there is nothing to check.
        </p>
      ) : null}

      {busy ? (
        <Note kind="info">
          <Spinner /> Checking {unchecked.length || 'the'} picture{unchecked.length === 1 ? '' : 's'}: each
          frame is drawn first so the reviewer sees what a viewer will. The first check after starting the
          studio takes about a minute.
        </Note>
      ) : null}
      <ErrorNote error={error} />

      {shown.length ? (
        <>
          <p className="hint" style={{ marginTop: 0 }}>
            {shown.length} picture{shown.length === 1 ? '' : 's'} checked by {record ? record.by.join(' and ') : ''}
            {record && record.sawFrames ? ', looking at the frames' : ', on a description of each'}:{' '}
            <b>{t.right} right</b>
            {out ? <>, <b>{out} taken out</b></> : null}
            {t.unsure ? <>, {t.unsure} not sure</> : null}.
          </p>
          <div className="picture-list">
            {shown.map((r) => {
              const v = VERDICT[r.verdict];
              return (
                <div key={r.key} className={'picture-row ' + v.cls}>
                  {r.frame ? (
                    <img src={r.frame} alt="" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                  ) : null}
                  <div className="picture-main">
                    <div>
                      <span className={'picture-chip ' + v.cls}>{r.removed ? (r.reported ? 'Taken out by you' : 'Taken out') : r.kept && isFlagged(r.verdict) ? 'Kept by you' : v.label}</span>{' '}
                      <span className="hint">Scene {r.scene + 1}</span>
                    </div>
                    <div className="picture-words">{r.words}</div>
                    <div className="hint">On the line: &ldquo;{r.narration}&rdquo;</div>
                    {r.reason ? <div className="picture-reason">{r.reason}</div> : null}
                    {r.said && r.said.length > 1 ? (
                      <div className="hint">{r.said.map((s) => s.by + ': ' + VERDICT[s.verdict].label.toLowerCase()).join(' · ')}</div>
                    ) : null}
                  </div>
                  {r.removed ? (
                    <button className="btn ghost" onClick={() => putBack(r.key)} title={r.reported ? 'Show this picture after all. Your mark on the test bench stays.' : 'The reviewer was wrong: show this picture after all'}>
                      Put it back
                    </button>
                  ) : reporting === r.key ? (
                    <div className="picture-report">
                      <input
                        type="text"
                        value={reportNote}
                        autoFocus
                        placeholder="What is wrong with it? (optional)"
                        onChange={(e) => setReportNote(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') void reportWrong(r); if (e.key === 'Escape') setReporting(null); }}
                      />
                      <button className="btn small danger" disabled={sending} onClick={() => reportWrong(r)}>
                        {sending ? <Spinner /> : null} Take it out
                      </button>
                      <button className="btn small ghost" disabled={sending} onClick={() => setReporting(null)}>Cancel</button>
                    </div>
                  ) : (
                    <button className="btn ghost" onClick={() => { setReporting(r.key); setReportNote(''); }}
                      title="It is wrong, whatever the reviewers said: take it out, and keep it on the test bench as a wrong picture">
                      Wrong picture
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      ) : null}

      {record && record.problems && record.problems.length ? (
        <Note kind="warn" title="One reviewer could not be reached">
          {record.problems.join(' ')}
        </Note>
      ) : null}

      {notDrawn.length ? (
        <div className="picture-notes">
          <b>Asked for, and not drawn</b>
          {notDrawn.map((x) => (
            <div key={x.i} className="hint">Scene {x.i + 1}: {x.note}</div>
          ))}
        </div>
      ) : null}

      {!canCheck && unchecked.length ? (
        <Note kind="info" title={unchecked.length === 1 ? 'One picture has not been checked' : unchecked.length + ' pictures have not been checked'}>
          Add a Gemini key on step 1 and every diagram is checked against the line it sits on before you
          spend anything on the voice.
        </Note>
      ) : null}

      {canCheck && (unchecked.length || shown.length) ? (
        <div className="actions" style={{ marginTop: 10 }}>
          <button className="btn ghost" onClick={run} disabled={busy}>
            {busy ? <Spinner /> : '🔍'} {shown.length ? 'Check the pictures again' : 'Check the pictures'}
          </button>
        </div>
      ) : null}
    </div>
  );
};
