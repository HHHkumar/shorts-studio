import React, { useState } from 'react';
import { api } from '../lib/api';
import { ErrorNote, Spinner } from './controls';

// ---------------------------------------------------------------------------
// A rehearsal against the live Gemini text features (server/live-check.mjs):
// a sample question through the formula card and the doodle directions, with
// every reply checked for the shape the video needs. Free tier - nothing is
// drawn or voiced - so it is safe to press after any update, before a real
// video depends on it.
// ---------------------------------------------------------------------------

export const LiveCheck: React.FC<{ geminiKey: string; geminiModel: string }> = ({ geminiKey, geminiModel }) => {
  const [busy, setBusy] = useState(false);
  const [checks, setChecks] = useState<{ name: string; ok: boolean; detail: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    setChecks(null);
    try {
      const out = await api.liveCheck({ apiKey: geminiKey, model: geminiModel });
      setChecks(out.checks);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const passed = checks ? checks.filter((c) => c.ok).length : 0;
  return (
    <div className="live-check">
      <div className="actions" style={{ marginTop: 0 }}>
        <button className="btn ghost" onClick={run} disabled={busy || geminiKey.trim().length < 6}>
          {busy ? <><Spinner /> Rehearsing…</> : 'Rehearse the Gemini features (free)'}
        </button>
        <span className="hint">
          Runs a sample question through the formula card and the doodle directing, and checks the replies.
          Nothing is drawn or voiced.
        </span>
      </div>
      <ErrorNote error={error} />
      {checks ? (
        <div className="live-check-list">
          <b>{passed === checks.length ? '✓ All ' + passed + ' checks passed' : passed + ' of ' + checks.length + ' checks passed'}</b>
          {checks.map((c) => (
            <div key={c.name} className={c.ok ? 'ok' : 'bad'}>
              {c.ok ? '✓' : '✗'} {c.name}{c.detail ? <span className="hint"> — {c.detail}</span> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};
