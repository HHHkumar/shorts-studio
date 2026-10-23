import React, { useEffect, useState } from 'react';
import { api, type EquipmentKindView, type EquipmentView } from '../lib/api';
import { ErrorNote, Note, Spinner, TextInput } from './controls';

// ---------------------------------------------------------------------------
// The equipment drawings a doodle may show.
//
// An image model is never asked to draw a transformer, a motor or a meter for
// a video: it would draw something transformer-like, and wrong in ways an
// engineer sees at once. Instead each kind is drawn once, here - or uploaded -
// and checked against the list beside it before it is approved. From then on
// every scene that names it shows that drawing, exactly, free.
//
// The kinds your own videos asked for most come first, with how many scenes
// went without a picture for want of one.
// ---------------------------------------------------------------------------

const readFile = (file: File) => new Promise<string>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result || ''));
  r.onerror = () => reject(new Error('That file could not be read.'));
  r.readAsDataURL(file);
});

const KindCard: React.FC<{
  kind: EquipmentKindView;
  geminiKey: string;
  busy: string;
  run: (label: string, job: () => Promise<EquipmentView | void>) => Promise<void>;
}> = ({ kind, geminiKey, busy, run }) => {
  const working = busy.startsWith(kind.id + ':');
  const noKey = geminiKey.trim().length < 6;
  return (
    <div className={'drawing-card' + (kind.approved ? ' approved' : '')}>
      <div className="drawing-head">
        <b>{kind.name}</b>
        {kind.custom ? <span className="drawing-tag">yours</span> : null}
        {kind.wanted ? <span className="drawing-tag wanted" title="Scenes in your saved videos that named it and went without a picture">{kind.wanted} scene{kind.wanted === 1 ? '' : 's'} waiting</span> : null}
        <span className="spacer" />
        {kind.approved ? <span className="drawing-tag ok">approved</span> : <span className="drawing-tag">not approved</span>}
      </div>

      <div className="drawing-body">
        <div className="drawing-current">
          {kind.approved ? (
            <img src={'/' + kind.approved.src} alt={kind.name} />
          ) : (
            <div className="drawing-empty">No drawing yet.<br />Scenes that name it get the engineer on his own.</div>
          )}
        </div>
        <div className="drawing-words">
          <div className="hint"><b>Drawn as:</b> {kind.draw}</div>
          <div className="drawing-check"><b>Check before approving:</b> {kind.check}</div>
          <div className="hint">Named in a scene as: {kind.words.slice(0, 6).join(', ')}{kind.words.length > 6 ? '…' : ''}</div>
        </div>
      </div>

      {kind.candidates.length ? (
        <div className="drawing-candidates">
          {kind.candidates.slice(0, 6).map((src) => (
            <div key={src} className="drawing-candidate">
              <img src={'/' + src} alt="" />
              <div className="actions" style={{ marginTop: 6 }}>
                <button className="btn small primary" disabled={working} onClick={() => run(kind.id + ':approve', () => api.equipmentApprove(kind.id, src))} title="It passes the check above: show it in every scene that names this">
                  Approve
                </button>
                <button className="btn small ghost" disabled={working} onClick={() => run(kind.id + ':discard', () => api.equipmentDiscard(kind.id, src))}>
                  Discard
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="actions" style={{ marginTop: 10 }}>
        <button className="btn small" disabled={working || noKey} onClick={() => run(kind.id + ':draw', async () => { await api.equipmentDraw(geminiKey.trim(), 'gemini-3.1-flash-image', kind.id); })}
          title={noKey ? 'Add a Gemini key on step 1 to draw' : 'One drawing in the doodle look, to look at and approve or discard'}>
          {busy === kind.id + ':draw' ? <Spinner /> : '✏️'} Draw one (~4c)
        </button>
        <label className="btn small ghost" title="A drawing you made, or have the right to use">
          ⬆ Upload my own
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            disabled={working}
            onChange={(e) => {
              const file = e.target.files && e.target.files[0];
              e.target.value = '';
              if (file) void run(kind.id + ':upload', async () => { await api.equipmentUpload(kind.id, await readFile(file)); });
            }}
          />
        </label>
        {kind.approved ? (
          <button className="btn small ghost" disabled={working} onClick={() => run(kind.id + ':withdraw', () => api.equipmentWithdraw(kind.id))}
            title="Stop showing it in new scenes. Videos already made with it keep it.">
            Withdraw approval
          </button>
        ) : null}
        {working && busy !== kind.id + ':draw' ? <Spinner /> : null}
      </div>
    </div>
  );
};

export const DrawingsView: React.FC<{ geminiKey: string; onClose: () => void }> = ({ geminiKey, onClose }) => {
  const [view, setView] = useState<EquipmentView | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [adding, setAdding] = useState({ name: '', draw: '', check: '' });

  const load = () => api.equipment().then(setView).catch((e) => setError(e instanceof Error ? e.message : String(e)));
  useEffect(() => { void load(); }, []);

  /** One action at a time, then the whole page read again: a candidate or an approval changes the list. */
  const run = async (label: string, job: () => Promise<EquipmentView | void>) => {
    setBusy(label);
    setError(null);
    try {
      const next = await job();
      if (next) setView(next); else await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy('');
    }
  };

  const kinds = view ? view.kinds : [];
  // The ones that matter first: approved, waited for, or already drawn.
  const shown = showAll ? kinds : kinds.filter((k) => k.approved || k.wanted || k.candidates.length || k.custom);
  const hidden = kinds.length - shown.length;

  return (
    <div className="panel drawings-view">
      <div className="actions" style={{ marginTop: 0 }}>
        <h2 style={{ margin: 0 }}>Equipment drawings</h2>
        <div className="spacer" />
        <button className="btn ghost" onClick={onClose}>Back to the video</button>
      </div>
      <p className="lede">
        A doodle never has an image model draw a transformer, a motor or a meter for a video — it would draw
        something that only looks like one. Each piece of equipment is drawn once here, or uploaded, and
        approved only when it passes the check beside it. Every scene that names it then shows that drawing,
        exactly, in every video, for nothing.
      </p>

      <ErrorNote error={error} />

      {view ? (
        <Note kind={view.approvedCount ? 'good' : 'info'} title={view.approvedCount ? view.approvedCount + ' approved' : 'Nothing approved yet'}>
          {view.approvedCount
            ? 'Scenes that name an approved kind show its drawing; the rest show the engineer on his own.'
            : 'Until something is approved, a scene that names equipment shows the engineer on his own, explaining. Start with the ones your videos asked for most, at the top.'}
        </Note>
      ) : <Note kind="info"><Spinner /> Reading the drawings…</Note>}

      <div className="drawing-list">
        {shown.map((k) => <KindCard key={k.id} kind={k} geminiKey={geminiKey} busy={busy} run={run} />)}
      </div>
      {hidden > 0 ? (
        <div className="actions">
          <button className="btn ghost" onClick={() => setShowAll(true)}>Show the other {hidden} kinds on the list</button>
        </div>
      ) : null}

      {view && view.unlisted.length ? (
        <Note kind="info" title="Named in your videos, and not on the list">
          {view.unlisted.slice(0, 12).map((u) => u.name + ' (' + u.count + ')').join(', ')}. Add one below by that name to
          give it a drawing.
        </Note>
      ) : null}

      <details className="help" style={{ marginTop: 16 }}>
        <summary>Add equipment that is not on the list</summary>
        <div className="inner">
          <div className="grid" style={{ marginTop: 10 }}>
            <TextInput label="Name" value={adding.name} placeholder="Buchholz relay" onChange={(v) => setAdding((a) => ({ ...a, name: v }))}
              hint="Scenes that use this name will show its drawing." />
            <TextInput label="What to check before approving" value={adding.check} onChange={(v) => setAdding((a) => ({ ...a, check: v }))}
              hint="Optional: the parts that must be there, the mistakes to look for." />
          </div>
          <div className="field" style={{ marginTop: 10 }}>
            <label>What the drawing shows</label>
            <textarea rows={3} value={adding.draw} onChange={(e) => setAdding((a) => ({ ...a, draw: e.target.value }))}
              placeholder="a small gas-collecting chamber in the pipe between the transformer tank and the conservator, with two floats inside and a test cock on top" />
            <div className="hint">The parts, and how they sit. This is what the image model is given, so name nothing that should not be there.</div>
          </div>
          <div className="actions">
            <button className="btn" disabled={Boolean(busy) || !adding.name.trim()} onClick={() => run('add', async () => {
              const next = await api.equipmentAdd(adding);
              setAdding({ name: '', draw: '', check: '' });
              return next;
            })}>
              Add it
            </button>
          </div>
        </div>
      </details>
    </div>
  );
};
