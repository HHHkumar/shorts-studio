import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api';
import type { QuizContent } from '../lib/types';
import {
  DOODLE_ENERGIES, DOODLE_SUBJECTS, doodleScenes, ENGINEER_POSES, energyFor, fieldLabels, needsDrawing, POSE_LABELS,
  poseFor, stagingFor, tidyDirection, type DoodleDirection, type DoodleSubject, type TextField,
} from '../lib/doodle';
import { Check, ErrorNote, Note, Select, Spinner, TextInput } from './controls';

// ---------------------------------------------------------------------------
// Doodles: the mascot, directed and drawn for every scene of this video.
//
// Shown on the Look step in place of the photo picker whenever the Doodle
// look is chosen. Two presses, in order:
//
//   Direct - Gemini writes what the engineer does in each scene. Text only,
//            one request, and every field stays editable afterwards.
//   Draw   - each directed scene is drawn against the mascot's model sheet,
//            a few at a time, each appearing as it lands. The price is on
//            the button before it is pressed.
//
// Any single scene can be redrawn. No rule stops an image model misbehaving
// every time, so the fix for one bad drawing is one more drawing, not a
// whole video's worth.
// ---------------------------------------------------------------------------

type Props = {
  content: QuizContent;
  setContent: (updater: (prev: QuizContent) => QuizContent) => void;
  geminiKey: string;
  geminiModel?: string;
  energy: string;
  setEnergy: (v: string) => void;
  orientation: string;
  showVisuals: boolean;
  onOpenMascot?: () => void;
  /** The engineer is animated beside the pictures rather than drawn into them. */
  animated: boolean;
  setAnimated: (v: boolean) => void;
};

/** Enough to be quick, few enough that a rate limit is unlikely. */
const AT_ONCE = 3;

const hash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
};

export const DoodlePanel: React.FC<Props> = ({
  content, setContent, geminiKey, geminiModel, energy, setEnergy, orientation, showVisuals, onOpenMascot,
  animated, setAnimated,
}) => {
  const [models, setModels] = useState<{ id: string; label: string; cents: number }[]>([]);
  const [hasMascot, setHasMascot] = useState<boolean | null>(null);
  const [modelId, setModelId] = useState('gemini-3.1-flash-image');
  const [directing, setDirecting] = useState(false);
  const [drawing, setDrawing] = useState<{ done: number; total: number } | null>(null);
  const [redrawing, setRedrawing] = useState<Set<number>>(new Set());
  const [noSheet, setNoSheet] = useState<Set<number>>(new Set());
  const [notes, setNotes] = useState<string[]>([]);
  /** Scenes the picture rule would not draw, and why. */
  const [refused, setRefused] = useState<Record<number, string>>({});
  /** "Wrong picture": the scene open for a note, the note, and the scenes reported this session. */
  const [reportingScene, setReportingScene] = useState<number | null>(null);
  const [reportNote, setReportNote] = useState('');
  const [reported, setReported] = useState<Set<number>>(new Set());

  /**
   * The person says a drawing is wrong. It is taken out at once, and what was
   * asked for, what came back and what they said go to the test bench
   * (bench/drawings.json), where the picture rule is measured against it.
   */
  const reportWrong = async (i: number) => {
    const line = script[i];
    if (!line || !line.doodleSrc) return;
    setError(null);
    try {
      await api.reportDrawing({ videoId: '', topic: content.topic || '', scene: i, line, animated, note: reportNote.trim() });
      updateLine(i, { doodleSrc: '', doodleApproved: '', doodleUnchecked: false });
      setReported((prev) => new Set(prev).add(i));
      setReportingScene(null);
      setReportNote('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  const [error, setError] = useState<string | null>(null);
  const stop = useRef(false);

  useEffect(() => {
    api.mascotLab()
      .then((info) => { setModels(info.models); setHasMascot(Boolean(info.mascot)); })
      .catch(() => setHasMascot(null));
  }, []);

  const script = content.script || [];
  const eligible = useMemo(() => doodleScenes(script, showVisuals), [script, showVisuals]);
  const directed = eligible.filter((i) => script[i] && script[i].doodle);
  // What still needs a picture. An animated engineer with nothing beside him
  // needs none; one drawn into an old picture needs it drawn again.
  const undrawn = directed.filter((i) => needsDrawing(script[i], animated));
  const drawable = directed.filter((i) => needsDrawing({ ...script[i], doodleSrc: undefined }, animated));
  const skipped = script.map((_, i) => i).filter((i) => !eligible.includes(i));
  const jobId = 'doodle-' + hash(content.question || content.topic || 'video');

  const model = models.find((m) => m.id === modelId);
  const price = (n: number) => (model ? ' (~' + model.cents * n + 'c)' : '');
  const noKey = geminiKey.trim().length < 6;
  const busy = directing || drawing !== null;

  const updateLine = (i: number, patch: Partial<{ doodle: DoodleDirection; doodleSrc: string; doodleProps: boolean; doodleApproved: string; doodleUnchecked: boolean }>) =>
    setContent((prev) => ({
      ...prev,
      script: prev.script.map((line, j) => (j === i ? { ...line, ...patch } : line)),
    }));

  const direct = async () => {
    setDirecting(true);
    setError(null);
    setNotes([]);
    try {
      const out = await api.doodleDirections({
        apiKey: geminiKey, model: geminiModel || 'gemini-2.5-flash', content, scenes: eligible, energy, animated,
      });
      setContent((prev) => ({
        ...prev,
        script: prev.script.map((line, i) => {
          const d = out.directions[String(i)];
          if (!d) return line;
          // An approved equipment drawing is the picture as it is: nothing to draw, nothing to pay.
          const pic = out.pictures && out.pictures[String(i)];
          return pic
            ? { ...line, doodle: d, doodleSrc: pic.src, doodleProps: pic.props, doodleApproved: pic.equipment, doodleUnchecked: false }
            : { ...line, doodle: d, doodleApproved: undefined, doodleUnchecked: false };
        }),
      }));
      setRefused({});
      setNotes(out.notes);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDirecting(false);
    }
  };

  /**
   * Draw one scene. Throws, so the batch can count failures and keep going.
   * A scene the picture rule refuses is not drawn: the reason goes beside it,
   * with a way to have it drawn anyway - by name, one scene, never in a batch.
   */
  const drawOne = async (i: number, force = false) => {
    const line = script[i];
    const direction = line && tidyDirection(line.doodle);
    if (!direction) throw new Error('Scene ' + i + ' has no direction yet.');
    const out = await api.doodleDraw({
      apiKey: geminiKey, modelId, jobId, scene: i, kind: line.kind, direction, energy, orientation, animated, force,
    });
    if (out.refused || !out.src) {
      setRefused((prev) => ({ ...prev, [i]: out.why || 'The picture rule refused this one.' }));
      return;
    }
    setRefused((prev) => { const next = { ...prev }; delete next[i]; return next; });
    updateLine(i, { doodleSrc: out.src, doodleProps: out.props === true, doodleApproved: out.approved || '', doodleUnchecked: out.unchecked === true });
    setNoSheet((prev) => {
      const next = new Set(prev);
      if (out.referenced) next.delete(i); else next.add(i);
      return next;
    });
  };

  const drawMany = async (list: number[]) => {
    if (!list.length) return;
    stop.current = false;
    setError(null);
    setDrawing({ done: 0, total: list.length });
    const queue = [...list];
    const failures: string[] = [];
    let done = 0;
    const worker = async () => {
      while (queue.length && !stop.current) {
        const i = queue.shift()!;
        try {
          await drawOne(i);
        } catch (e) {
          failures.push('Scene ' + i + ': ' + (e instanceof Error ? e.message : String(e)));
        }
        done += 1;
        setDrawing({ done, total: list.length });
      }
    };
    await Promise.all(new Array(Math.min(AT_ONCE, list.length)).fill(0).map(worker));
    setDrawing(null);
    if (failures.length) setError(failures.length + ' scene' + (failures.length > 1 ? 's' : '') + ' did not draw. ' + failures[0]);
  };

  const redraw = async (i: number, force = false) => {
    setRedrawing((prev) => new Set(prev).add(i));
    setError(null);
    try {
      await drawOne(i, force);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRedrawing((prev) => { const next = new Set(prev); next.delete(i); return next; });
    }
  };

  const editField = (i: number, key: TextField | 'subject' | 'pose', value: string) => {
    const current = script[i].doodle || { subject: 'mascot' as DoodleSubject, action: '', emotion: '', props: '', gag: 'none' };
    updateLine(i, { doodle: { ...current, [key]: value } });
  };

  if (hasMascot === false) {
    return (
      <Note kind="warn" title="Design the mascot first">
        Every doodle is drawn against the mascot&rsquo;s model sheet, and there isn&rsquo;t one yet.{' '}
        {onOpenMascot ? <button className="link-btn" onClick={onOpenMascot}>Open the Mascot lab</button> : 'Open the Mascot lab from the top bar.'}
      </Note>
    );
  }

  return (
    <div className="doodle-panel">
      <p className="hint">
        Everything in the Doodle look is drawn by hand: the diagrams, charts, formulas, cards and
        icons are inked with a marker wobble, and the answer gets circled. Gemini chooses, scene by
        scene, between the engineer and an illustration of the thing itself — switch any you
        disagree with. Scenes that show their own worked-out diagram keep it rather than a doodle.
        Backdrop photos, the moving backdrop and the drifting symbols are off in this look.
      </p>

      <Check
        label="Animated engineer"
        hint={
          'He stands beside the pictures and moves: takes up a pose for each scene, blinks, and acts '
          + 'out the action words as they are said. Directing is enough for him to appear — only the '
          + 'things beside him are drawn, so a scene that is just his reaction costs nothing. Off, he '
          + 'is drawn into each picture as a still.'
        }
        checked={animated}
        onChange={setAnimated}
      />

      <div className="grid">
        <Select
          label="Energy"
          hint={(DOODLE_ENERGIES.find((e) => e.id === energy) || DOODLE_ENERGIES[1]).hint + ' Teaching scenes stay calm whatever this says.'}
          value={energy}
          options={DOODLE_ENERGIES.map((e) => ({ id: e.id, label: e.label }))}
          onChange={setEnergy}
          disabled={busy}
        />
        <Select
          label="Drawing model"
          hint="Flash is the best of the four at keeping the mascot the same."
          value={modelId}
          options={models.length ? models.map((m) => ({ id: m.id, label: m.label })) : [modelId]}
          onChange={setModelId}
          disabled={busy}
        />
      </div>

      {noKey ? <Note kind="warn" title="No Gemini key yet">Add it on the Keys step — directing and drawing both use it.</Note> : null}
      <ErrorNote error={error} />
      {notes.length ? (
        <Note kind="info" title="Gemini's directions, checked">
          {notes.map((n) => <div key={n}>{n}</div>)}
        </Note>
      ) : null}

      <div className="actions doodle-actions">
        <button className="btn" disabled={noKey || busy || !eligible.length} onClick={direct}>
          {directing ? <><Spinner /> Directing {eligible.length} scenes…</> : (directed.length ? 'Direct again' : 'Direct ' + eligible.length + ' scenes')}
        </button>
        {drawing ? (
          <>
            <span className="progress-line"><Spinner /> Drawing {Math.min(drawing.done + 1, drawing.total)} of {drawing.total}…</span>
            <button className="btn danger small" onClick={() => { stop.current = true; }}>Stop after these</button>
          </>
        ) : (
          <>
            <button className="btn primary" disabled={noKey || busy || !undrawn.length} onClick={() => drawMany(undrawn)}>
              {'Draw ' + (undrawn.length || '') + ' scene' + (undrawn.length === 1 ? '' : 's') + price(undrawn.length)}
            </button>
            {drawable.length && !undrawn.length ? (
              <button className="btn ghost" disabled={noKey || busy} onClick={() => drawMany(drawable)}>
                {'Redraw all ' + drawable.length + price(drawable.length)}
              </button>
            ) : null}
          </>
        )}
      </div>

      {!directed.length && eligible.length ? (
        <p className="hint">
          {animated
            ? 'Press Direct first: Gemini chooses the engineer\'s pose in each scene, and what stands beside him. He appears as soon as it is done; then draw what is beside him.'
            : 'Press Direct first: Gemini writes what the engineer does in each scene, then you draw them.'}
        </p>
      ) : null}

      <div className="doodle-list">
        {eligible.map((i) => {
          const line = script[i];
          const d = line.doodle;
          const level = energyFor(line.kind, energy);
          const staged = stagingFor(line, showVisuals, animated);
          // Animated and an engineer scene: his pose and what is beside him
          // are what matter; "doing" and "feeling" only feed the still.
          const moving = animated && Boolean(d) && (d!.subject || 'mascot') === 'mascot';
          const nothingBeside = moving && !d!.props.trim();
          const stale = moving && Boolean(line.doodleSrc) && !line.doodleProps;
          const fields: TextField[] = moving ? ['props', 'gag'] : ['action', 'emotion', 'props', 'gag'];
          return (
            <div className="doodle-row" key={i}>
              <div className="doodle-thumb">
                {line.doodleSrc ? <img src={'/' + line.doodleSrc} alt={'Scene ' + i} /> : (
                  <span>{!d ? '—' : staged.engineer ? '🕺 ' + POSE_LABELS[poseFor(d, line.kind)] : 'Not drawn'}</span>
                )}
              </div>
              <div className="doodle-body">
                <div className="doodle-head">
                  <b>Scene {i + 1}</b>
                  <span className="kind">{line.kind}</span>
                  <span className={'energy ' + level}>{level}</span>
                  {d ? (
                    // Gemini chooses, but it is the creator's picture: switching
                    // keeps the words and redraws as the other kind next time.
                    <select
                      className="subject-pick"
                      value={d.subject || 'mascot'}
                      disabled={busy}
                      onChange={(e) => editField(i, 'subject', e.target.value)}
                      title="What this scene's drawing is of"
                    >
                      {DOODLE_SUBJECTS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                    </select>
                  ) : null}
                  {moving ? (
                    <select
                      className="subject-pick"
                      value={poseFor(d, line.kind)}
                      disabled={busy}
                      onChange={(e) => editField(i, 'pose', e.target.value)}
                      title="The engineer's pose in this scene"
                    >
                      {ENGINEER_POSES.map((p) => <option key={p} value={p}>{POSE_LABELS[p]}</option>)}
                    </select>
                  ) : null}
                  {stale ? <span className="warn-tag" title="Drawn before he was animated: he is in the picture, so it shows as a still until redrawn.">has him in it</span> : null}
                  {noSheet.has(i) ? <span className="warn-tag" title="The model refused the model sheet; the mascot may not match.">no model sheet</span> : null}
                  {line.doodleSrc && line.doodleApproved ? (
                    <span className="ok-tag" title="An equipment drawing approved on the Drawings page, shown as it was approved. Nothing is drawn or charged for it.">approved drawing</span>
                  ) : null}
                  {line.doodleSrc && line.doodleUnchecked ? (
                    <span className="warn-tag" title="You had this drawn although the picture rule refused it. Nobody else has checked it: look at it closely.">not checked</span>
                  ) : null}
                  <span className="spacer" />
                  {nothingBeside ? (
                    <span className="hint" title="Name something in 'Beside him' to draw it next to him.">Nothing to draw</span>
                  ) : (
                    <button
                      className="btn small"
                      disabled={noKey || busy || redrawing.has(i) || !(d && d.action)}
                      onClick={() => redraw(i)}
                    >
                      {redrawing.has(i) ? <Spinner /> : line.doodleSrc && !stale ? 'Redraw' : 'Draw'}{price(1)}
                    </button>
                  )}
                </div>
                <p className="doodle-said">{line.narration}</p>
                {line.doodleSrc && reportingScene !== i ? (
                  <button className="link-btn doodle-report-link" onClick={() => { setReportingScene(i); setReportNote(''); }}
                    title="Take this drawing out, and keep it on the test bench as a wrong picture">
                    Wrong picture
                  </button>
                ) : null}
                {reportingScene === i ? (
                  <div className="picture-report" style={{ marginBottom: 8 }}>
                    <input
                      type="text"
                      value={reportNote}
                      autoFocus
                      placeholder="What is wrong with it? (optional)"
                      onChange={(e) => setReportNote(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') void reportWrong(i); if (e.key === 'Escape') setReportingScene(null); }}
                    />
                    <button className="btn small danger" onClick={() => reportWrong(i)}>Take it out</button>
                    <button className="btn small ghost" onClick={() => setReportingScene(null)}>Cancel</button>
                  </div>
                ) : null}
                {reported.has(i) && !line.doodleSrc ? (
                  <div className="hint" style={{ marginBottom: 8 }}>
                    Taken out, and kept on the test bench. Change what it shows before drawing it again, or leave the
                    engineer on his own.
                  </div>
                ) : null}
                {refused[i] ? (
                  <div className="doodle-refused">
                    <span>
                      <b>Not drawn.</b> {refused[i]} Change what it shows to something everyday, approve a drawing of
                      the equipment on the Drawings page, or leave the engineer on his own.
                    </span>
                    <button
                      className="btn small ghost"
                      disabled={noKey || busy || redrawing.has(i)}
                      onClick={() => redraw(i, true)}
                      title="Draw it anyway. It is marked not checked, and it is yours to look at before the video goes out."
                    >
                      Draw it anyway{price(1)}
                    </button>
                  </div>
                ) : null}
                {d ? (
                  <div className="doodle-fields">
                    {fields.map((key) => (
                      <TextInput
                        key={key}
                        label={moving && key === 'props' ? 'Beside him' : fieldLabels(d.subject)[key]}
                        value={d[key]}
                        onChange={(v) => editField(i, key, v)}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {skipped.length ? (
        <p className="hint">
          No doodle for scene{skipped.length > 1 ? 's' : ''} {skipped.map((i) => i + 1).join(', ')} —{' '}
          {skipped.length > 1 ? 'they already show a diagram of their own' : 'it already shows a diagram of its own'}.
        </p>
      ) : null}
    </div>
  );
};
