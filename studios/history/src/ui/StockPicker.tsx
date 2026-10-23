// ---------------------------------------------------------------------------
// Free stock photos and videos for one shot.
//
// Search (pre-filled with the shot's suggested stock search), pick photos or
// videos, choose the libraries, click a result to use it. The file is
// downloaded into the project, and its credit - author, library, licence -
// is kept with the shot for the on-screen credit and the description.
// ---------------------------------------------------------------------------

import React, { useEffect, useState } from 'react';
import { api, type StockCandidate } from '../lib/api';
import { useStoredState } from '../lib/store';
import type { Scene, Shot } from '../lib/types';
import { useStudio } from './context';
import { defaultQuery } from '../lib/stock';

export { defaultQuery };
import { ErrorNote, Note, Spinner } from './controls';

export const STOCK_LIBRARIES = [
  { id: 'pexels', label: 'Pexels', videos: true, key: 'pexels' as const },
  { id: 'pixabay', label: 'Pixabay', videos: true, key: 'pixabay' as const },
  { id: 'wikimedia', label: 'Wikimedia', videos: false, key: null },
  { id: 'openverse', label: 'Openverse', videos: false, key: null },
  { id: 'nasa', label: 'NASA', videos: false, key: null },
];

const fmtSecs = (s: number) => (s ? Math.round(s) + 's' : '');

export const StockPicker: React.FC<{ scene: Scene; shot: Shot; onDone?: () => void }> = ({ scene, shot, onDone }) => {
  const { project, keys, updateShot } = useStudio();
  const [query, setQuery] = useState(defaultQuery(shot, scene.narration));
  const [type, setType] = useStoredState<'photo' | 'video'>('stockType', 'photo');
  const [libs, setLibs] = useStoredState<string[]>('stockLibraries', ['pexels', 'pixabay', 'wikimedia', 'openverse']);
  const [results, setResults] = useState<StockCandidate[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [busy, setBusy] = useState<'' | 'search' | string>('');
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const usable = STOCK_LIBRARIES.filter((l) => (type === 'video' ? l.videos : true));
  const chosen = libs.filter((id) => usable.some((l) => l.id === id));

  const search = async (q = query) => {
    if (!q.trim()) return;
    setBusy('search');
    setError(null);
    try {
      const r = await api.stockSearch({ query: q, type, providers: chosen.length ? chosen : usable.map((l) => l.id) });
      setResults(r.results);
      setNotes(r.notes);
      if (r.query && r.query !== q) setQuery(r.query);
      setSearched(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  };

  // Search straight away with the suggested words, and again when photos/videos is switched.
  useEffect(() => { search(); }, [type]); // eslint-disable-line react-hooks/exhaustive-deps

  const use = async (c: StockCandidate) => {
    setBusy(c.id);
    setError(null);
    try {
      const r = await api.stockUse({ projectId: project.id, shotId: shot.id, candidate: c });
      if (r.type === 'video') updateShot(shot.id, { video: r.src, videoSeconds: r.seconds, credit: r.credit, stockQuery: query, graphic: null });
      else updateShot(shot.id, { image: r.src, imageSource: 'upload', video: '', videoSeconds: 0, credit: r.credit, stockQuery: query, graphic: null });
      onDone?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="stock">
      <div className="row" style={{ marginTop: 0 }}>
        <div className="seg tiny-seg">
          <button className={type === 'photo' ? 'on' : ''} onClick={() => setType('photo')}>📷 Photos</button>
          <button className={type === 'video' ? 'on' : ''} onClick={() => setType('video')}>🎬 Videos</button>
        </div>
        <input className="text" value={query} placeholder="e.g. Taj Mahal sunrise" onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') search(); }} />
        <button className="btn small primary" disabled={busy === 'search' || !query.trim()} onClick={() => search()}>{busy === 'search' ? <Spinner /> : '🔎'} Search</button>
      </div>
      <div className="row">
        {usable.map((l) => {
          const on = chosen.includes(l.id);
          const missingKey = l.key && !keys[l.key];
          return (
            <button key={l.id} className={'chip' + (on ? ' on' : '')} title={missingKey ? 'Add a free ' + l.label + ' key on the Keys step' : ''}
              onClick={() => setLibs((x) => (x.includes(l.id) ? x.filter((y) => y !== l.id) : [...x, l.id]))}>
              {l.label}{missingKey ? ' 🔑' : ''}
            </button>
          );
        })}
        {type === 'video' ? <span className="stat">Videos come from Pexels and Pixabay (free keys).</span> : null}
      </div>
      {notes.length ? <p className="stat">{notes.join(' · ')}</p> : null}
      <ErrorNote error={error} />
      {searched && !results.length && busy !== 'search' ? <Note kind="info">Nothing found. Try fewer, plainer words — a place, an object, a person’s name.</Note> : null}
      <div className="stock-grid">
        {results.map((c) => (
          <button key={c.id} className="stock-item" disabled={Boolean(busy)} onClick={() => use(c)} title={c.title + '\n' + c.credit.author + ' · ' + c.credit.source + ' · ' + c.credit.license}>
            {c.type === 'video' && c.preview ? (
              <video src={c.preview} poster={c.thumb} muted loop playsInline onMouseEnter={(e) => e.currentTarget.play().catch(() => undefined)} onMouseLeave={(e) => e.currentTarget.pause()} />
            ) : (
              <img src={c.thumb} alt="" loading="lazy" />
            )}
            <span className="prov">{c.provider}{c.duration ? ' · ' + fmtSecs(c.duration) : ''}</span>
            <span className={'lic' + (c.credit.required ? ' req' : '')}>{c.credit.required ? 'credit · ' : ''}{c.credit.license.replace('Content License', '').replace('License', '').trim() || 'free'}</span>
            {busy === c.id ? <span className="busy"><Spinner /> Downloading…</span> : null}
          </button>
        ))}
      </div>
      {results.length ? (
        <p className="stat">
          Only licences that allow use in a monetised video, with cropping, are shown. “credit” ones show a small on-screen credit
          (change in Look) and go in the description. Photos of real people are fine for news and commentary — never use them to suggest
          someone endorses something.
        </p>
      ) : null}
    </div>
  );
};
