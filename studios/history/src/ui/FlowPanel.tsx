// ---------------------------------------------------------------------------
// Animate in Google Flow: pick shots -> motion prompts -> export a pack ->
// generate in Flow -> upload the clips back. Each clip plays instead of its
// still picture, exactly as a Veo clip made in the app would.
// ---------------------------------------------------------------------------

import React, { useRef, useState } from 'react';
import { api, fileToBase64, mediaUrl } from '../lib/api';
import { FLOW_URL, labelFromFileName, labelledShots, musicSections, templateMotionPrompt, templateMusicPrompt, CAMERA_WORDS, ATMOSPHERE_WORDS } from '../lib/flow';
import { styleFor } from '../lib/styles';
import { useStudio } from './context';
import { ErrorNote, Note, Spinner } from './controls';
import { ChatbotHelper } from './ChatbotHelper';

export const FlowPanel: React.FC = () => {
  const { project, updateShot, keys, prefs } = useStudio();
  const [busy, setBusy] = useState<'' | 'prompts' | 'pack' | 'upload'>('');
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [pack, setPack] = useState<{ folder: string; frames: number; ingredients: number } | null>(null);
  const [progress, setProgress] = useState('');
  const [copied, setCopied] = useState('');
  const projectRef = useRef(project);
  projectRef.current = project;

  const all = labelledShots(project);
  const chosen = all.filter((x) => x.shot.flow);
  const withClip = chosen.filter((x) => x.shot.video).length;
  const writerKey = prefs.writer === 'claude' ? keys.claude : keys.gemini;
  const promptFor = (x: (typeof all)[number]) => x.shot.motionPrompt || templateMotionPrompt(x.scene, x.shot);

  const pick = (which: 'openings' | 'chapters' | 'all' | 'none') => {
    all.forEach((x, n) => {
      const on = which === 'all' ? true
        : which === 'none' ? false
          : which === 'openings' ? x.label === '1' || (n < 3 && x.shot.image !== '')
            : x.label === '1' || (x.scene.chapter.trim() !== '' && x.scene.shots[0].id === x.shot.id);
      if (Boolean(x.shot.flow) !== on) updateShot(x.shot.id, { flow: on });
    });
  };

  const motionBody = () => ({
    styleName: styleFor(project.styleId).label,
    shots: labelledShots(projectRef.current).filter((x) => x.shot.flow).map((x) => ({
      label: x.label, narration: x.scene.narration, picture: x.shot.imagePrompt,
      camera: CAMERA_WORDS[x.shot.motion], atmosphere: ATMOSPHERE_WORDS[x.scene.effect],
    })),
  });
  const applyMotion = (r: { shots: { label: string; prompt: string }[] }) => {
    const now = labelledShots(projectRef.current);
    for (const s of r.shots) {
      const x = now.find((c) => c.label === s.label);
      if (x) updateShot(x.shot.id, { motionPrompt: s.prompt });
    }
    setNote('Wrote ' + r.shots.length + ' motion prompts. Edit any of them below.');
  };

  const writePrompts = async () => {
    if (!chosen.length) return setError('Tick the shots to animate first.');
    if (chosen.some((x) => x.shot.motionPrompt) && !window.confirm('Rewrite the motion prompts you already have?')) return;
    setBusy('prompts');
    setError(null);
    try {
      applyMotion(await api.motionPrompts({
        provider: prefs.writer,
        model: prefs.writer === 'claude' ? prefs.claudeModel : prefs.geminiModel,
        ...motionBody(),
      }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  };

  const exportPack = async () => {
    setBusy('pack');
    setError(null);
    try {
      const ingredients = project.scenes.flatMap((s) => s.shots).filter((s) => s.layer && s.layer.image)
        .map((s, i) => ({ name: (s.layer!.prompt || 'character') + '-' + (i + 1), image: s.layer!.image }));
      const sections = musicSections(project);
      const r = await api.flowPack({
        projectId: project.id,
        title: project.title || project.topic,
        items: chosen.filter((x) => x.shot.image).map((x) => ({ label: x.label, image: x.shot.image, prompt: promptFor(x) })),
        ingredients,
        music: sections.map((sec, i) => ({
          label: sec.label,
          prompt: project.music.find((m) => m.sceneId === sec.sceneId)?.prompt || templateMusicPrompt(project, sec, i),
        })),
      });
      setPack(r);
      api.openOutput(r.folder).catch(() => undefined);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  };

  const uploadOne = async (shotId: string, file: File) => {
    const r = await api.uploadClip({ projectId: projectRef.current.id, shotId, fileName: file.name, dataBase64: await fileToBase64(file) });
    updateShot(shotId, { video: r.src, videoSeconds: r.seconds, flow: true });
  };

  const uploadMany = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setBusy('upload');
    setError(null);
    const byLabel = new Map(labelledShots(projectRef.current).map((x) => [x.label, x.shot.id]));
    const unmatched: string[] = [];
    let done = 0;
    try {
      for (const f of [...files]) {
        const id = byLabel.get(labelFromFileName(f.name));
        if (!id) {
          unmatched.push(f.name);
          continue;
        }
        setProgress('Uploading ' + f.name + '…');
        await uploadOne(id, f);
        done++;
      }
      setNote(done + ' clip' + (done === 1 ? '' : 's') + ' added.' + (unmatched.length ? ' Not matched to a shot (rename them like 03b.mp4): ' + unmatched.join(', ') : ''));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
      setProgress('');
    }
  };

  const copy = (text: string, what: string) => navigator.clipboard.writeText(text).then(() => {
    setCopied(what);
    setTimeout(() => setCopied(''), 1400);
  });

  return (
    <div className="flow-panel">
      <div className="flow-head">
        <b>🎞 Animate in Google Flow</b>
        <a className="btn small" href={FLOW_URL} target="_blank" rel="noreferrer">Open Flow ↗</a>
      </div>
      <ol className="flow-steps">
        <li><b>Tick the shots</b> to animate — the opening and chapter starts are the best use of credits.</li>
        <li><b>Motion prompts</b> — say what moves. ✨ writes them from the script; edit freely.</li>
        <li><b>Export the pack</b> — a folder of numbered start frames, character ingredients and the prompts in order.</li>
        <li>In Flow: <b>Frames to Video</b>, add a frame, paste its prompt, generate. Save the clip as its number (e.g. <span className="kbd">03b.mp4</span>).</li>
        <li><b>Upload the clips</b> — all at once; each finds its shot by name and plays instead of the still.</li>
      </ol>

      <div className="toolbar">
        <span className="stat"><b>{chosen.length}</b> ticked · <b>{withClip}</b> with a clip</span>
        <button className="btn small ghost" onClick={() => pick('chapters')}>Tick opening + chapter starts</button>
        <button className="btn small ghost" onClick={() => pick('all')}>All</button>
        <button className="btn small ghost" onClick={() => pick('none')}>None</button>
        <div className="spacer" />
        <button className="btn small" disabled={Boolean(busy) || !chosen.length || !writerKey} onClick={writePrompts} title={writerKey ? '' : 'Needs a Gemini or Claude key - the templates below work without one'}>
          {busy === 'prompts' ? <><Spinner /> Writing…</> : '✨ Write motion prompts'}
        </button>
        <button className="btn small primary" disabled={Boolean(busy) || !chosen.some((x) => x.shot.image)} onClick={exportPack}>
          {busy === 'pack' ? <><Spinner /> Exporting…</> : '📦 Export Flow pack'}
        </button>
        <label className={'btn small' + (busy ? ' disabled' : '')} style={{ cursor: 'pointer' }}>
          {busy === 'upload' ? <><Spinner /> {progress}</> : '⬆ Upload clips from Flow'}
          <input type="file" accept="video/mp4,video/webm" multiple hidden disabled={Boolean(busy)} onChange={(e) => { uploadMany(e.target.files); e.target.value = ''; }} />
        </label>
      </div>

      {pack ? (
        <Note kind="good" title="Flow pack exported">
          {pack.frames} start frames{pack.ingredients ? ', ' + pack.ingredients + ' character ingredients' : ''}, prompts.txt, music-prompts.txt and HOW-TO.txt in <span className="kbd">out\{pack.folder}</span>.{' '}
          <button className="link-btn" onClick={() => api.openOutput(pack.folder)}>Open the folder</button>
        </Note>
      ) : null}
      {note ? <Note kind="info">{note}</Note> : null}
      <ErrorNote error={error} />

      {chosen.length ? <ChatbotHelper<{ shots: { label: string; prompt: string }[] }> task="motion" body={motionBody} label="Write the motion prompts with any chatbot" onResult={applyMotion} /> : null}
      <div className="flow-grid">
        {all.map((x) => (
          <div key={x.shot.id} className={'flow-card' + (x.shot.flow ? ' on' : '')}>
            <label className="flow-thumb">
              <input type="checkbox" checked={Boolean(x.shot.flow)} onChange={(e) => updateShot(x.shot.id, { flow: e.target.checked })} />
              {x.shot.video ? <video src={mediaUrl(x.shot.video)} muted loop autoPlay /> : x.shot.image ? <img src={mediaUrl(x.shot.image)} alt="" /> : <span className="empty">no picture</span>}
              <span className="lbl">{x.label}{x.shot.video ? ' 🎞' : ''}</span>
            </label>
            {x.shot.flow ? (
              <div className="flow-body">
                <textarea
                  value={x.shot.motionPrompt || ''}
                  placeholder={templateMotionPrompt(x.scene, x.shot)}
                  onChange={(e) => updateShot(x.shot.id, { motionPrompt: e.target.value })}
                />
                <div className="row">
                  <button className="btn small" onClick={() => copy(promptFor(x), x.shot.id)}>{copied === x.shot.id ? 'Copied ✓' : 'Copy prompt'}</button>
                  {x.shot.image ? <a className="btn small ghost" href={mediaUrl(x.shot.image)} download={x.label.replace(/^(\d+)/, (n) => n.padStart(2, '0')) + '.jpg'}>Save frame</a> : null}
                  <label className="btn small ghost" style={{ cursor: 'pointer' }}>
                    Upload clip
                    <input type="file" accept="video/mp4,video/webm" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadOne(x.shot.id, f).catch((er) => setError((er as Error).message)); e.target.value = ''; }} />
                  </label>
                  {x.shot.video ? (
                    <>
                      <label className="stat"><input type="checkbox" checked={Boolean(x.shot.videoSound)} onChange={(e) => updateShot(x.shot.id, { videoSound: e.target.checked })} /> keep its sound</label>
                      <button className="btn small ghost danger" onClick={() => updateShot(x.shot.id, { video: '', videoSeconds: 0 })}>Remove clip</button>
                    </>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
};
