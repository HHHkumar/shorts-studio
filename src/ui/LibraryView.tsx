import React, { useEffect, useState } from 'react';
import { api, type HistoryProject, type LibraryVideo } from '../lib/api';
import { ErrorNote, Note, Spinner } from './controls';
import { LANGUAGES } from '../lib/languages';

// ---------------------------------------------------------------------------
// The library: every video made, newest first, with what it cost and where it
// went. Opening one brings back its script, design, formula card and voice
// (whatever of it is on this computer); the video being worked on is saved as
// it changes, so opening another never loses it.
//
// Saved in the library/ folder, one file per video, and committed with the
// code - so the other computer has the same list after a `git pull`.
// ---------------------------------------------------------------------------

const when = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
};

export const cost = (cents: number, characters: number) => [
  cents > 0 ? '$' + (cents / 100).toFixed(2) + ' of pictures' : '',
  characters > 0 ? characters.toLocaleString() + ' voice characters' : '',
].filter(Boolean).join(' · ') || 'nothing spent';

export const LibraryView: React.FC<{
  currentId: string;
  onOpen: (id: string) => void;
  /** Make a copy of this video in another language, and open it. */
  onTranslate: (id: string, language: string) => Promise<void>;
  onNew: () => void;
  onClose: () => void;
}> = ({ currentId, onOpen, onTranslate, onNew, onClose }) => {
  const [translating, setTranslating] = useState('');
  const [videos, setVideos] = useState<LibraryVideo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  const [history, setHistory] = useState<HistoryProject[] | null>(null);

  const load = () => {
    api.library()
      .then((r) => setVideos(r.videos))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    // History Studio's videos too: one program, one list. Missing is not an error here.
    api.historyProjects().then(setHistory).catch(() => setHistory([]));
  };
  useEffect(load, []);

  const remove = async (v: LibraryVideo) => {
    if (!confirm('Delete “' + v.title.slice(0, 80) + '” from the library? Its rendered MP4 files in out/ are kept.')) return;
    try {
      await api.libraryDelete(v.id);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const shown = (videos || []).filter((v) =>
    !filter.trim() || (v.title + ' ' + v.subject + ' ' + v.topic).toLowerCase().includes(filter.trim().toLowerCase()));
  const total = (videos || []).reduce((n, v) => n + v.cents, 0);

  return (
    <div className="panel">
      <h2>Library</h2>
      <p className="lede">
        Every video you have made, saved as you work. Open one to fix it, render it again or publish it.
        The list is in the <span className="kbd">library</span> folder and travels with the code, so your
        other computer sees it after a <span className="kbd">git pull</span> — the voice clips and drawings
        do not travel, and are simply made again there.
      </p>
      <ErrorNote error={error} />

      <div className="actions">
        <button className="btn primary" onClick={onNew}>✨ Start a new video</button>
        <input
          className="library-filter"
          placeholder="Search by question or topic"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <span className="spacer" />
        <button className="btn ghost" onClick={onClose}>Back to the video</button>
      </div>

      {videos === null ? <p className="hint"><Spinner /> Reading the library…</p> : null}
      {videos && !videos.length ? (
        <Note kind="info" title="Nothing here yet">Every video you make from now on is added automatically.</Note>
      ) : null}
      {videos && videos.length ? (
        <p className="hint">{videos.length} video{videos.length > 1 ? 's' : ''} · {cost(total, 0)} in all</p>
      ) : null}

      <div className="library-list">
        {shown.map((v) => (
          <div className={'library-row' + (v.id === currentId ? ' current' : '')} key={v.id}>
            <div className="library-main">
              <div className="library-title">{v.title}</div>
              <div className="hint">
                {v.videoKind === 'explainer' ? 'Explainer' : 'Quiz'} · {[v.subject, v.topic].filter(Boolean).join(' · ')} · {when(v.updatedAt)}
              </div>
              <div className="hint">
                {cost(v.cents, v.characters)}
                {v.renders ? ' · rendered ' + v.renders + '×' : ''}
                {v.lastRender && v.lastRender.url ? <> · <a href={v.lastRender.url} target="_blank" rel="noreferrer">last render</a></> : null}
                {Object.entries(v.published).map(([where, url]) => (
                  <span key={where}> · <a href={url} target="_blank" rel="noreferrer">on {where}</a></span>
                ))}
              </div>
            </div>
            <div className="library-actions">
              {v.id === currentId ? <span className="tag">open now</span> : (
                <button className="btn small" onClick={() => onOpen(v.id)}>Open</button>
              )}
              <select
                className="library-translate"
                value=""
                disabled={Boolean(translating)}
                title="Make this video in another language"
                onChange={(e) => {
                  const language = e.target.value;
                  if (!language) return;
                  setTranslating(v.id);
                  setError(null);
                  onTranslate(v.id, language)
                    .catch((err) => setError(err instanceof Error ? err.message : String(err)))
                    .finally(() => setTranslating(''));
                }}
              >
                <option value="">{translating === v.id ? 'Translating…' : '🌐 Translate'}</option>
                {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
              <button className="btn small ghost" onClick={() => remove(v)} title="Delete from the library">✕</button>
            </div>
          </div>
        ))}
      </div>

      {history && history.length ? (
        <>
          <div className="section-title" style={{ marginTop: 22 }}>History &amp; news videos</div>
          <p className="hint" style={{ marginTop: 0 }}>
            Made in History Studio, the other studio of this app. They open there, with their own steps.
          </p>
          <div className="library-list">
            {history
              .filter((p) => !filter.trim() || p.title.toLowerCase().includes(filter.trim().toLowerCase()))
              .map((p) => (
                <div className="library-row" key={p.id}>
                  <div className="library-main">
                    <div className="library-title">{p.title}</div>
                    <div className="hint">
                      History Studio · {p.scenes} scenes · {p.pictures} pictures · {p.voiced} voiced · {when(p.updatedAt)}
                    </div>
                  </div>
                  <div className="library-actions">
                    <button className="btn small" onClick={() => openInHistory(p.id)}>Open in History Studio →</button>
                  </div>
                </div>
              ))}
          </div>
        </>
      ) : null}
    </div>
  );
};

/**
 * Open a project in History Studio. It is another page of this app, on the same
 * address, so the project it should open can be left where it looks for it.
 */
function openInHistory(id: string) {
  try {
    localStorage.setItem('history-studio:projectId', JSON.stringify(id));
  } catch {
    // storage blocked: the page opens on its project list instead
  }
  window.location.href = '/history.html';
}
