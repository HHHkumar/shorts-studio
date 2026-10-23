import React, { useEffect, useState } from 'react';
import { api, mediaUrl, type ProjectSummary } from '../lib/api';
import { ErrorNote } from './controls';

export const Home: React.FC<{ onOpen: (id: string) => void; onNew: () => void; keysPanel: React.ReactNode }> = ({ onOpen, onNew, keysPanel }) => {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showKeys, setShowKeys] = useState(false);

  const load = () => api.projects().then((r) => setProjects(r.projects)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const remove = async (p: ProjectSummary) => {
    if (!window.confirm('Delete "' + p.title + '" and all its pictures and voice clips? This cannot be undone.')) return;
    try {
      await api.deleteProject(p.id);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <>
      <div className="panel">
        <h2>Your videos</h2>
        <p className="lede">Each video is saved as you work, so you can come back to it any time.</p>
        <ErrorNote error={error} />
        <div className="projects">
          <button className="proj new" onClick={onNew}>＋ New video</button>
          {(projects || []).map((p) => (
            <div key={p.id} className="proj" role="button" tabIndex={0} onClick={() => onOpen(p.id)} onKeyDown={(e) => e.key === 'Enter' && onOpen(p.id)}>
              <div className="cover">{p.cover ? <img src={mediaUrl(p.cover)} alt="" /> : '🏺'}</div>
              <div className="body">
                <div className="t">{p.title}</div>
                <div className="s">
                  {p.scenes} scenes · {p.pictures} pictures · {p.voiced} voiced
                </div>
                <div className="s" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{p.updatedAt ? new Date(p.updatedAt).toLocaleString() : ''}</span>
                  <button className="link-btn" style={{ color: 'var(--bad)', fontSize: 12 }} onClick={(e) => { e.stopPropagation(); remove(p); }}>
                    delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="panel">
        <button className="link-btn" onClick={() => setShowKeys((v) => !v)}>{showKeys ? 'Hide' : 'Show'} API keys</button>
        {showKeys ? <div style={{ marginTop: 18 }}>{keysPanel}</div> : null}
      </div>
    </>
  );
};
