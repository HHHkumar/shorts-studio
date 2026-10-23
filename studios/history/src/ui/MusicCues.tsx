// ---------------------------------------------------------------------------
// Music by chapter, for Google Flow Music (or any music tool).
//
// One row for the opening and one per chapter. Each gets a brief to paste into
// Flow Music; the track that comes back plays from that point until the next
// row's track, crossfading between them and dipping under the narration.
// ---------------------------------------------------------------------------

import React, { useState } from 'react';
import { api, fileToBase64, mediaUrl } from '../lib/api';
import { musicSections, templateMusicPrompt } from '../lib/flow';
import { formatDuration } from '../lib/timeline';
import type { MusicCue } from '../lib/types';
import { useStudio } from './context';
import { ErrorNote, Note, Spinner } from './controls';
import { ChatbotHelper } from './ChatbotHelper';

const player = typeof Audio !== 'undefined' ? new Audio() : null;

export const MusicCues: React.FC = () => {
  const { project, update, keys, prefs } = useStudio();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState('');
  const sections = musicSections(project);
  const writerKey = prefs.writer === 'claude' ? keys.claude : keys.gemini;

  const cueFor = (sceneId: string): MusicCue => project.music.find((m) => m.sceneId === sceneId) || { sceneId, prompt: '', src: '', name: '' };
  const setCue = (sceneId: string, patch: Partial<MusicCue>) => update((p) => {
    const has = p.music.some((m) => m.sceneId === sceneId);
    const music = has
      ? p.music.map((m) => (m.sceneId === sceneId ? { ...m, ...patch } : m))
      : [...p.music, { sceneId, prompt: '', src: '', name: '', ...patch }];
    return { ...p, music };
  });

  const musicBody = () => ({
    title: project.title || project.topic,
    sections: sections.map((s) => ({ label: s.label, title: s.title, summary: s.summary, length: formatDuration(Math.max(30, s.seconds)) })),
  });
  const applyBriefs = (r: { sections: { label: string; prompt: string }[] }) => {
    for (const b of r.sections) {
      const sec = sections.find((s) => s.label === b.label);
      if (sec) setCue(sec.sceneId, { prompt: b.prompt });
    }
  };

  const write = async () => {
    if (project.music.some((m) => m.prompt) && !window.confirm('Rewrite the music briefs you already have?')) return;
    setBusy('write');
    setError(null);
    try {
      applyBriefs(await api.musicBriefs({
        provider: prefs.writer,
        model: prefs.writer === 'claude' ? prefs.claudeModel : prefs.geminiModel,
        ...musicBody(),
      }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  };

  const upload = async (sceneId: string, file: File | undefined) => {
    if (!file) return;
    setBusy(sceneId);
    setError(null);
    try {
      const r = await api.uploadMusic({ projectId: project.id, fileName: file.name, dataBase64: await fileToBase64(file) });
      setCue(sceneId, { src: r.src, name: r.name });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  };

  const copy = (text: string, id: string) => navigator.clipboard.writeText(text).then(() => {
    setCopied(id);
    setTimeout(() => setCopied(''), 1400);
  });

  return (
    <div style={{ marginTop: 18 }}>
      <div className="section-title">Music by chapter (Google Flow Music)</div>
      <p className="stat" style={{ margin: '0 0 10px' }}>
        A track for the opening and one per chapter: each plays until the next one takes over, with a crossfade. Copy a brief into
        Flow Music, generate, download, and upload it here. Rows without a track use the music chosen above.
        {sections.length < 2 ? ' Add chapter titles (Scenes step → 🎬 Animate, or ✨ suggest) to get more rows.' : ''}
      </p>
      <div className="toolbar" style={{ marginTop: 0 }}>
        <button className="btn small" disabled={Boolean(busy) || !writerKey} onClick={write} title={writerKey ? '' : 'Needs a Gemini or Claude key - the templates work without one'}>
          {busy === 'write' ? <><Spinner /> Writing…</> : '✨ Write music briefs'}
        </button>
        <button className="btn small ghost" onClick={() => copy(sections.map((s, i) => '=== ' + s.label + '\n' + (cueFor(s.sceneId).prompt || templateMusicPrompt(project, s, i))).join('\n\n'), 'all')}>
          {copied === 'all' ? 'Copied ✓' : '📋 Copy all briefs'}
        </button>
      </div>
      <ChatbotHelper<{ sections: { label: string; prompt: string }[] }> task="music" body={musicBody} label="Write the music briefs with any chatbot" onResult={applyBriefs} />
      <ErrorNote error={error} />
      {sections.map((s, i) => {
        const cue = cueFor(s.sceneId);
        const brief = cue.prompt || templateMusicPrompt(project, s, i);
        return (
          <div key={s.sceneId} className="cue-row">
            <div className="cue-head">
              <b>{s.label}</b>
              <span className="stat">about {formatDuration(s.seconds)}</span>
              <div className="spacer" />
              {cue.src ? (
                <>
                  <span className="pill good" title={cue.name}>♪ {cue.name.slice(0, 28) || 'track'}</span>
                  <button className="icon-btn" title="Play" onClick={() => { if (player) { player.src = mediaUrl(cue.src); player.play().catch(() => undefined); } }}>▶</button>
                  <button className="icon-btn" title="Stop" onClick={() => player?.pause()}>■</button>
                  <button className="icon-btn" title="Remove track" onClick={() => setCue(s.sceneId, { src: '', name: '' })}>✕</button>
                </>
              ) : <span className="pill">no track</span>}
            </div>
            <textarea value={cue.prompt} placeholder={brief} onChange={(e) => setCue(s.sceneId, { prompt: e.target.value })} />
            <div className="row">
              <button className="btn small" onClick={() => copy(brief, s.sceneId)}>{copied === s.sceneId ? 'Copied ✓' : 'Copy brief'}</button>
              <label className="btn small ghost" style={{ cursor: 'pointer' }}>
                {busy === s.sceneId ? <Spinner /> : '⬆'} {cue.src ? 'Replace track' : 'Upload track'}
                <input type="file" accept="audio/*" hidden onChange={(e) => { upload(s.sceneId, e.target.files?.[0]); e.target.value = ''; }} />
              </label>
            </div>
          </div>
        );
      })}
      {project.music.some((m) => m.src) ? (
        <Note kind="info">Chapter tracks crossfade over 1.5 s at each chapter start, and duck under the voice like the main music.</Note>
      ) : null}
    </div>
  );
};
