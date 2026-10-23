import React, { useEffect, useRef, useState } from 'react';
import { api, ELECTRICAL_SUBJECTS, type TopicForm } from '../lib/api';
import type { DesignSettings } from '../lib/types';
import { FPS } from '../lib/types';
import { buildScenes } from '../lib/timeline';
import { tidySheet } from '../lib/formula-card';
import { SUBTOPICS } from '../lib/subtopics';
import {
  inFilter, nextBenchQuestions, type BenchCase, type BenchFilter, type BenchMark, type BenchPicture, type BenchView as View,
} from '../lib/bench';
import { ErrorNote, Note, Spinner } from './controls';

// ---------------------------------------------------------------------------
// The test bench: the same questions every time, every picture marked by a
// person, and a score that either moves or does not.
//
// Three things are compared for each picture - what the rules do with it
// today, what the picture check says, and what you say. Yours is the truth:
// the first two are being measured against it.
// ---------------------------------------------------------------------------

const MARKS: { id: BenchMark; label: string; title: string }[] = [
  { id: 'right', label: 'Right', title: 'It shows what the line says, and nothing on it is false' },
  { id: 'wrong', label: 'Wrong', title: 'Something on it is false or misleading for this question' },
  { id: 'unrelated', label: 'Beside the point', title: 'Not false, but it does not show what this line says' },
];

const FILTERS: { id: BenchFilter; label: string }[] = [
  { id: 'todo', label: 'To mark' },
  { id: 'all', label: 'All' },
  { id: 'bad', label: 'Marked wrong' },
  { id: 'slipped', label: 'Wrong, and still shown' },
  { id: 'disagree', label: 'Reviewer disagrees with me' },
];

const VERDICT_LABEL: Record<string, string> = { right: 'right', wrong: 'wrong', unrelated: 'beside the point', unsure: 'not sure' };

const pct = (n: number | null) => (n === null ? '—' : n + '%');
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const Tile: React.FC<{ value: string; label: string; detail: string; tone?: 'good' | 'bad' }> = ({ value, label, detail, tone }) => (
  <div className={'bench-tile' + (tone ? ' ' + tone : '')}>
    <div className="bench-value">{value}</div>
    <div className="bench-label">{label}</div>
    <div className="hint">{detail}</div>
  </div>
);

const PictureRow: React.FC<{
  p: BenchPicture;
  onMark: (mark: BenchMark | '', note: string) => void;
}> = ({ p, onMark }) => {
  const [note, setNote] = useState(p.note);
  useEffect(() => setNote(p.note), [p.note]);
  const suggested = p.markedBy === 'claude';
  const today = p.refused.length
    ? 'Today: not drawn — it ' + p.refused.join('; ') + '.'
    : p.verdict && !p.shown
      ? 'Today: taken out by the picture check.'
      : 'Today: shown in the video.';
  return (
    <div className={'bench-picture' + (p.mark && !suggested ? ' marked-' + p.mark : '')}>
      {p.frame ? (
        <a href={p.frame} target="_blank" rel="noreferrer" title="Open the frame full size">
          <img src={p.frame} alt="" loading="lazy" />
        </a>
      ) : (
        <div className="bench-noframe">No frame yet</div>
      )}
      <div className="bench-main">
        <div className="picture-words">{p.words}</div>
        <div className="hint">Scene {p.scene + 1}, on the line: &ldquo;{p.narration}&rdquo;</div>
        <div className={'bench-today' + (p.shown ? '' : ' hidden')}>{today}</div>
        {p.verdict ? (
          <div className="hint">
            The picture check says <b>{VERDICT_LABEL[p.verdict]}</b>{p.reason ? ': ' + p.reason : '.'}
            {p.said.length > 1 ? ' (' + p.said.map((s) => s.by + ': ' + VERDICT_LABEL[s.verdict]).join(', ') + ')' : ''}
          </div>
        ) : null}
        <div className="bench-marks">
          {MARKS.map((m) => (
            <button
              key={m.id}
              className={'bench-mark ' + m.id + (p.mark === m.id ? (suggested ? ' suggested' : ' on') : '')}
              title={m.title}
              onClick={() => onMark(p.mark === m.id && !suggested ? '' : m.id, note)}
            >
              {m.label}
            </button>
          ))}
          <input
            className="bench-note"
            placeholder="What is wrong with it? (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => { if (p.mark && note !== p.note) onMark(p.mark, note); }}
          />
        </div>
        {suggested ? (
          <div className="hint">
            Claude&rsquo;s first pass says <b>{MARKS.find((m) => m.id === p.mark)?.label.toLowerCase()}</b>
            {p.note ? ' — ' + p.note : ''}. It does not count until you press a mark.
          </div>
        ) : null}
      </div>
    </div>
  );
};

export const BenchView: React.FC<{
  geminiKey: string;
  geminiModel: string;
  deepseekKey: string;
  deepseekModel: string;
  form: TopicForm;
  design: DesignSettings;
  onClose: () => void;
}> = ({ geminiKey, geminiModel, deepseekKey, deepseekModel, form, design, onClose }) => {
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState('');
  const [filter, setFilter] = useState<BenchFilter>('todo');
  const [howMany, setHowMany] = useState(10);
  const stop = useRef(false);
  // Pictures marked under the current filter stay where they are until the
  // filter changes: a row that vanished on the click that marked it could not
  // be looked at again, or unmarked, without going to find it.
  const [held, setHeld] = useState<Set<string>>(new Set());
  const choose = (f: BenchFilter) => { setFilter(f); setHeld(new Set()); };

  const hasKey = geminiKey.trim().length > 5;
  const keys = { geminiKey: geminiKey.trim(), geminiModel, deepseekKey: deepseekKey.trim(), deepseekModel };

  useEffect(() => {
    api.bench().then(setView).catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const guard = async (label: string, fn: () => Promise<void>) => {
    if (busy) return;
    stop.current = false;
    setBusy(label);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy('');
    }
  };

  /** Draw one case's frames in its own look and, with a key, have it reviewed. */
  const checkCase = async (id: string) => {
    const { case: found } = await api.benchCase(id);
    const look = {
      ...design,
      layout: found.look.layout as DesignSettings['layout'],
      mode: found.look.mode as DesignSettings['mode'],
      orientation: found.look.orientation as DesignSettings['orientation'],
    };
    const cards = tidySheet(found.content.formulas)?.cards.length ?? 0;
    const { scenes, totalDurationInFrames } = buildScenes(found.content.script, {}, look, FPS, cards);
    setView(await api.benchCheck(id, { ...keys, props: { content: found.content, scenes, design: look, fps: FPS, totalDurationInFrames } }));
  };

  const addLibrary = () => guard('Adding your library videos…', async () => {
    setView(await api.benchAddLibrary());
  });

  const checkAll = (cases: BenchCase[]) => guard('Checking…', async () => {
    for (const [n, c] of cases.entries()) {
      if (stop.current) break;
      setBusy('Checking ' + (n + 1) + ' of ' + cases.length + ': ' + c.topic);
      await checkCase(c.id);
    }
  });

  const addQuestions = () => guard('Writing…', async () => {
    const have = (view ? view.cases : []).map((c) => ({ subject: c.subject, topic: c.topic }));
    const todo = nextBenchQuestions(ELECTRICAL_SUBJECTS, SUBTOPICS, have, howMany);
    if (!todo.length) throw new Error('Every topic in the electrical syllabus is on the bench already.');
    for (const [n, q] of todo.entries()) {
      if (stop.current) break;
      setBusy('Writing ' + (n + 1) + ' of ' + todo.length + ': ' + q.topic);
      const { content } = await api.generate(geminiKey.trim(), geminiModel, {
        ...form, videoKind: 'mcq', provider: 'gemini', contentType: 'electrical',
        subject: q.subject, topic: q.topic, flavour: q.flavour, orientation: design.orientation,
      });
      // Filed under the syllabus topic it was asked for, so it is not asked for twice.
      const { id } = await api.benchAdd({ content: { ...content, subject: q.subject, topic: q.topic }, design, source: 'syllabus' });
      setBusy('Checking ' + (n + 1) + ' of ' + todo.length + ': ' + q.topic);
      await checkCase(id);
      // The free tier allows a handful of requests a minute.
      if (n < todo.length - 1) await wait(6000);
    }
  });

  const mark = async (c: BenchCase, p: BenchPicture, value: BenchMark | '', note: string) => {
    setHeld((h) => new Set(h).add(c.id + '/' + p.key));
    // Shown at once: a mark is a click, and waiting on each one would make marking a chore.
    setView((v) => (v ? {
      ...v,
      cases: v.cases.map((x) => (x.id !== c.id ? x : {
        ...x,
        pictures: x.pictures.map((y) => (y.key !== p.key ? y : { ...y, mark: value, note: value ? note : '', markedBy: value ? 'you' : '' })),
      })),
    } : v));
    try {
      const { score, provisional } = await api.benchMark({ id: c.id, key: p.key, mark: value, note });
      setView((v) => (v ? { ...v, score, provisional } : v));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const remove = (c: BenchCase) => guard('Removing…', async () => {
    if (!window.confirm('Take "' + c.topic + '" off the bench? Its marks go with it.')) return;
    setView(await api.benchRemove(c.id));
  });

  if (!view) {
    return (
      <div className="panel">
        <h2>Accuracy</h2>
        <ErrorNote error={error} />
        {error ? null : <p className="lede"><Spinner /> Opening the test bench…</p>}
      </div>
    );
  }

  const s = view.score;
  const count = (f: BenchFilter) => view.cases.reduce((n, c) => n + c.pictures.filter((p) => inFilter(p, f)).length, 0);
  const unchecked = view.cases.filter((c) => c.pictures.some((p) => !p.frame || (hasKey && !p.verdict)));
  const visible = view.cases
    .map((c) => ({ c, pictures: c.pictures.filter((p) => inFilter(p, filter) || held.has(c.id + '/' + p.key)) }))
    .filter((x) => x.pictures.length);

  return (
    <div className="panel bench">
      <h2>Accuracy — the test bench</h2>
      <p className="lede">
        The same questions every time, with every picture marked by you. A picture is <b>right</b> when it
        shows what its line says and nothing on it is false; <b>wrong</b> when something on it is false for
        this question; <b>beside the point</b> when it is merely about the same subject. Your marks are the
        truth the rules and the picture check are measured against, and a picture marked wrong stays here
        for good, as the standing test that it no longer gets through.
      </p>

      <div className="bench-tiles">
        <Tile
          value={pct(s.shownRightPct)}
          label="Right, of what a viewer sees"
          detail={s.shownRight + ' right and ' + s.shownWrong + ' wrong would be shown today'}
          tone={s.shownWrong ? 'bad' : s.marked ? 'good' : undefined}
        />
        <Tile
          value={String(s.shownWrong)}
          label="Wrong pictures still shown"
          detail="The number that has to be zero"
          tone={s.shownWrong ? 'bad' : s.marked ? 'good' : undefined}
        />
        <Tile
          value={pct(s.caughtPct)}
          label="Wrong pictures stopped"
          detail={s.byRules.caught + ' by the rules, ' + s.byReviewer.caught + ' by the picture check, ' + s.byReviewer.missed + ' missed'}
        />
        <Tile
          value={pct(s.keptPct)}
          label="Right pictures kept"
          detail={(s.byRules.lostRight + s.byReviewer.lostRight) + ' right ones lost to the checks'}
        />
        <Tile
          value={pct(s.askedRightPct)}
          label="Right, before any check"
          detail="What Gemini asks for, unfiltered"
        />
        <Tile
          value={s.marked + ' / ' + s.pictures}
          label="Marked by you"
          detail={s.cases + ' questions' + (s.suggested ? ' · ' + s.suggested + ' waiting on Claude’s first pass' : '')}
        />
      </div>

      {s.suggested ? (
        <Note kind="info" title={'Claude has been through ' + s.suggested + ' of these already'}>
          Each of those pictures carries a suggested mark, shown with a dashed outline, and the reason for
          it. None of them counts until you press a mark yourself — agree with one click, or choose
          another. If every suggestion stood, <b style={{ display: 'inline' }}>{pct(view.provisional.askedRightPct)}</b> of what Gemini
          asked for was right, and a video made today would show{' '}
          <b style={{ display: 'inline' }}>{view.provisional.shownRight} right and {view.provisional.shownWrong} wrong</b>.
        </Note>
      ) : null}

      {view.drawings && view.drawings.length ? (
        <details className="help" open>
          <summary>
            Doodles you reported wrong: {view.drawings.length}
            {(() => {
              const still = view.drawings.filter((d) => d.today.outcome === 'draw').length;
              const approved = view.drawings.filter((d) => d.today.outcome === 'approved').length;
              if (!still && !approved) return ' · the picture rule now refuses every one';
              return [still ? ' · ' + still + ' the picture rule would still draw' : '', approved ? ' · ' + approved + ' would show an approved drawing' : ''].join('');
            })()}
          </summary>
          <div className="inner">
            <p className="hint" style={{ marginTop: 10 }}>
              Each &ldquo;Wrong picture&rdquo; pressed on a doodle. One the rule would still draw is one it has not learned from
              yet — its words are what the next rule has to catch.
            </p>
            <div className="drawing-reports">
              {view.drawings.map((d) => (
                <div key={d.at} className={'drawing-report ' + (d.today.outcome === 'draw' ? 'bad' : 'ok')}>
                  {d.src ? <img src={'/' + d.src} alt="" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} /> : null}
                  <div>
                    <div><b>{d.topic || 'A video'}</b> · scene {d.scene + 1}</div>
                    <div className="hint">Asked for: {d.direction.subject === 'illustration' ? d.direction.action : d.direction.props || d.direction.action}</div>
                    {d.note ? <div>You said: {d.note}</div> : null}
                    <div className={d.today.outcome === 'none' ? 'hint' : 'warn-text'}>
                      Today: {d.today.outcome === 'draw'
                        ? 'it would still be drawn.'
                        : d.today.outcome === 'approved'
                          ? 'it would show the approved drawing of ' + d.today.equipment.toLowerCase() + ' — if that drawing is what is wrong, withdraw its approval on the Drawings page.'
                          : 'refused — it asked for ' + d.today.why + '.'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </details>
      ) : null}

      <div className="actions">
        <button className="btn" onClick={addLibrary} disabled={!!busy}>Add my library videos</button>
        <span className="bench-add">
          <button className="btn" onClick={addQuestions} disabled={!!busy || !hasKey} title={hasKey ? '' : 'Needs a Gemini key (step 1)'}>
            Add questions from the syllabus
          </button>
          <select value={howMany} onChange={(e) => setHowMany(Number(e.target.value))} disabled={!!busy} title="How many to add">
            {[5, 10, 20, 30].map((n) => <option key={n} value={n}>{n} at a time</option>)}
          </select>
        </span>
        {unchecked.length ? (
          <button className="btn" onClick={() => checkAll(unchecked)} disabled={!!busy}>
            {hasKey ? 'Draw and check' : 'Draw the frames of'} {unchecked.length} unchecked
          </button>
        ) : null}
        {busy ? <button className="btn ghost" onClick={() => { stop.current = true; }}>Stop after this one</button> : null}
        <button className="btn ghost" onClick={onClose}>Back to the video</button>
      </div>
      <p className="hint">
        Adding a question writes its script and checks its pictures; nothing is voiced, drawn or rendered,
        so it costs nothing on the free tier. Marks are saved in the <span className="kbd">bench</span> folder
        and travel with the code.
      </p>
      {busy ? <Note kind="info"><Spinner /> {busy}</Note> : null}
      <ErrorNote error={error} />

      <div className="bench-filters">
        {FILTERS.map((f) => (
          <button key={f.id} className={'bench-filter' + (filter === f.id ? ' on' : '')} onClick={() => choose(f.id)}>
            {f.label} <span>{count(f.id)}</span>
          </button>
        ))}
      </div>

      {!view.cases.length ? (
        <Note kind="info" title="The bench is empty">
          Start with <b style={{ display: 'inline' }}>Add my library videos</b>: the pictures in the videos you have already made are the
          best first test there is.
        </Note>
      ) : !visible.length ? (
        <p className="hint">Nothing under this filter.</p>
      ) : null}

      {visible.map(({ c, pictures }) => (
        <div key={c.id} className="bench-case">
          <div className="bench-head">
            <div className="bench-title">{c.topic} <span className="hint">· {c.subject} · {c.source === 'library' ? 'from your library' : 'from the syllabus'}</span></div>
            <div className="library-actions">
              <button className="btn ghost" onClick={() => checkAll([c])} disabled={!!busy}>{c.checkedAt ? 'Check again' : 'Draw and check'}</button>
              <button className="btn ghost" onClick={() => remove(c)} disabled={!!busy} title="Take this question off the bench">✕</button>
            </div>
          </div>
          <div className="bench-question">{c.question}</div>
          <div className="hint">Answer: {c.answer}</div>
          {pictures.map((p) => <PictureRow key={p.key} p={p} onMark={(m, note) => mark(c, p, m, note)} />)}
          {filter === 'all' && c.notDrawn.length ? (
            <div className="picture-notes">
              <b>Asked for, and not drawn</b>
              {c.notDrawn.map((x) => <div key={x.scene} className="hint">Scene {x.scene + 1}: {x.note}</div>)}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
};
