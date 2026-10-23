import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Player } from '@remotion/player';
import { api, mediaUrl, type RenderJob } from '../lib/api';
import { isStale } from '../lib/script';
import { shotLabel } from '../lib/styles';
import { buildShortTimeline, formatDuration, prettyDate, youtubeChapters } from '../lib/timeline';
import { FPS, HEIGHT, WIDTH, type ThumbnailSettings, type VideoProps } from '../lib/types';
import { HistoryVideo } from '../remotion/HistoryVideo';
import { Thumbnail, THUMB_H, THUMB_W, type ThumbnailProps } from '../remotion/Thumbnail';
import { useStudio } from './context';
import { ErrorNote, Note, Spinner } from './controls';
import { ChatbotHelper } from './ChatbotHelper';
import { creditsBlock, needsPicture, sourcesBlock } from '../lib/news';
import { stripTags } from '../lib/speech';

type Which = 'video' | 'short';

export const StepRender: React.FC<{ timeline: VideoProps }> = ({ timeline }) => {
  const { project, update, keys, prefs } = useStudio();
  const [job, setJob] = useState<(RenderJob & { which: Which }) | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renders, setRenders] = useState<{ name: string; url: string; bytes: number; at: string }[]>([]);
  const [copied, setCopied] = useState('');
  const [tidied, setTidied] = useState('');
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  const shots = project.scenes.flatMap((s) => s.shots);
  const noPic = shots.filter(needsPicture).length;
  const noVoice = project.scenes.filter((s) => !s.audio).length;
  const stale = project.scenes.filter(isStale).length;
  const seconds = timeline.totalFrames / FPS;
  const chapters = useMemo(() => youtubeChapters(timeline), [timeline]);

  const loadRenders = () => api.renders().then((r) => setRenders(r.renders)).catch(() => undefined);

  const follow = (id: string, which: Which) => {
    if (poll.current) clearInterval(poll.current);
    poll.current = setInterval(async () => {
      try {
        const j = await api.renderStatus(id);
        setJob({ ...j, which });
        if (j.status !== 'running') {
          if (poll.current) clearInterval(poll.current);
          loadRenders();
        }
      } catch (e) {
        setError((e as Error).message);
        if (poll.current) clearInterval(poll.current);
      }
    }, 1200);
  };

  useEffect(() => {
    loadRenders();
    // A render keeps going if the page is reloaded or she steps away; pick its progress back up.
    api.renderJobs()
      .then((r) => {
        const mine = r.jobs.find((j) => j.projectId === project.id);
        if (mine) follow(mine.id, 'video');
      })
      .catch(() => undefined);
    return () => { if (poll.current) clearInterval(poll.current); };
  }, []);

  const start = async (which: Which, quality: 'draft' | 'full') => {
    setError(null);
    setJob(null);
    setStarting(true);
    try {
      const props = which === 'short' ? buildShortTimeline(project) : timeline;
      const { jobId } = await api.render({ projectId: project.id, props, quality, composition: which === 'short' ? 'HistoryShort' : 'HistoryVideo' });
      follow(jobId, which);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStarting(false);
    }
  };

  const running = starting || job?.status === 'running';
  const eta = job && job.status === 'running' && job.progress > 0.03
    ? formatDuration(((Date.now() - job.startedAt) / 1000) * ((1 - job.progress) / job.progress))
    : '';

  const copy = async (text: string, what: string) => {
    await navigator.clipboard.writeText(text).catch(() => undefined);
    setCopied(what);
    setTimeout(() => setCopied(''), 1500);
  };

  const pub = project.publish;
  const progress = (which: Which) => (job && job.which === which ? (
    <>
      <div style={{ marginTop: 18 }}>
        <div className="bar"><div style={{ width: Math.round(job.progress * 100) + '%' }} /></div>
        <div className="progress-line">
          <span>{job.status === 'running' ? <><Spinner /> {job.stage}</> : job.stage}</span>
          <span>{Math.round(job.progress * 100)}%{eta ? ' · about ' + eta + ' left' : ''}</span>
        </div>
      </div>
      {job.status === 'error' ? <ErrorNote error={job.error} /> : null}
      {job.status === 'done' ? (
        <>
          <video className="videobox" src={job.url} controls style={which === 'short' ? { maxHeight: 520, width: 'auto', display: 'block', margin: '12px auto 0' } : undefined} />
          <div className="actions">
            <a className="btn" href={job.url} download>⬇ Download</a>
            <button className="btn" onClick={() => api.openOutput()}>📂 Show in folder</button>
          </div>
        </>
      ) : null}
    </>
  ) : null);

  return (
    <>
      <div className="panel">
        <h2>Render</h2>
        <p className="lede">
          {project.scenes.length} scenes, {formatDuration(seconds)} long. Make a quick 720p draft to watch it through, then the 1080p final for YouTube.
        </p>

        {noPic || noVoice || stale ? (
          <Note kind="warn" title="Not quite finished — it will still render">
            <ul>
              {noPic ? <li>{noPic} shot{noPic === 1 ? '' : 's'} with no picture (shows a blank card).</li> : null}
              {noVoice ? <li>{noVoice} scene{noVoice === 1 ? '' : 's'} with no voice (silent, captions only).</li> : null}
              {stale ? <li>{stale} scene{stale === 1 ? '' : 's'} whose words changed after recording — the old audio is used.</li> : null}
            </ul>
          </Note>
        ) : (
          <Note kind="good">Every shot has a picture and every scene a voice.</Note>
        )}

        <div className="actions">
          <button className="btn" disabled={running} onClick={() => start('video', 'draft')}>Quick draft (720p)</button>
          <button className="btn primary" disabled={running} onClick={() => start('video', 'full')}>🎬 Render final (1080p)</button>
        </div>
        <p className="stat" style={{ marginTop: 10 }}>
          Rendering runs on this computer: a draft takes about as long as the video ({formatDuration(seconds)}), the 1080p final roughly twice that. AI clips and heat haze make it slower. Keep the black helper window open.
        </p>
        {progress('video')}
        <ErrorNote error={error} />
      </div>

      <ShortPanel running={running} onRender={(q) => start('short', q)} progress={progress('short')} />
      <ThumbnailPanel writerKey={prefs.writer === 'claude' ? keys.claude : keys.gemini} />

      <div className="panel">
        <h2>For YouTube</h2>
        <p className="lede">Written with the script. Edit before posting.</p>
        {pub.titleIdeas.length ? (
          <div className="field">
            <label>Title ideas</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[project.title, ...pub.titleIdeas].filter(Boolean).map((t, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ flex: 1 }}>{t}</span>
                  <button className="btn small" onClick={() => copy(t, 't' + i)}>{copied === 't' + i ? 'Copied ✓' : 'Copy'}</button>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        <div className="field copybox" style={{ marginTop: 14 }}>
          <label>Description</label>
          <textarea rows={8} value={pub.description} onChange={(e) => update((p) => ({ ...p, publish: { ...p.publish, description: e.target.value } }))} />
          <div className="row">
            <button className="btn small" onClick={() => copy(pub.description, 'd')}>{copied === 'd' ? 'Copied ✓' : 'Copy description'}</button>
            {chapters ? (
              <button className="btn small" onClick={() => update((p) => ({ ...p, publish: { ...p.publish, description: p.publish.description.replace(/\n*Chapters:\n[\s\S]*?(\n\n|$)/, '\n\n').trim() + '\n\nChapters:\n' + chapters + '\n' } }))}>
                ⏱ Add chapters to description
              </button>
            ) : <span className="stat">Add at least 3 chapter titles (in 🎬 Animate, or ✨ Suggest) to get YouTube chapters.</span>}
            {project.kind === 'news' && project.sources.length ? (
              <button className="btn small" onClick={() => update((p) => ({ ...p, publish: { ...p.publish, description: p.publish.description.replace(/\n*Sources:\n[\s\S]*?Reporting as of [^\n]*\./, '').trim() + '\n\n' + sourcesBlock(p) + '\n\nReporting as of ' + prettyDate(p.asOf) + '.' } }))}>
                📰 Add sources to description
              </button>
            ) : null}
            {creditsBlock(project) ? (
              <button className="btn small" onClick={() => update((p) => ({ ...p, publish: { ...p.publish, description: p.publish.description.replace(/\n*Image & video credits:\n[\s\S]*?(?=\n\nSources:|\n\nReporting as of|$)/, '').trim() + '\n\n' + creditsBlock(p) } }))}>
                🖼 Add stock credits to description
              </button>
            ) : null}
          </div>
          {chapters ? <pre className="chapters">{chapters}</pre> : null}
        </div>
        <div className="field copybox" style={{ marginTop: 14 }}>
          <label>Tags</label>
          <textarea rows={2} value={pub.tags.join(', ')} onChange={(e) => update((p) => ({ ...p, publish: { ...p.publish, tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) } }))} />
          <div><button className="btn small" onClick={() => copy(pub.tags.join(', '), 'g')}>{copied === 'g' ? 'Copied ✓' : 'Copy tags'}</button></div>
        </div>
        {pub.factNotes.length ? (
          <Note kind="warn" title="Double-check before publishing">
            <ul className="facts">{pub.factNotes.map((f, i) => <li key={i}>{f}</li>)}</ul>
          </Note>
        ) : null}
        {shots.some((s) => s.imageSource === 'ai' || s.video) ? (
          <p className="stat">YouTube asks creators to disclose realistic AI-generated content. Illustrated pictures usually don’t need the label, but AI-animated clips may — and “Illustrations made with AI” in the description is a good habit.</p>
        ) : null}
      </div>

      <div className="panel">
        <h2>Finished files</h2>
        {renders.length ? (
          <div className="clips">
            {renders.map((r) => (
              <div key={r.name} className="clip-row" style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }}>
                <span className="txt">{r.name}</span>
                <span className="right">
                  <span className="stat">{r.bytes > 1e6 ? (r.bytes / 1e6).toFixed(0) + ' MB' : Math.round(r.bytes / 1e3) + ' KB'} · {new Date(r.at).toLocaleString()}</span>
                  <a className="btn small" href={r.url} target="_blank" rel="noreferrer">Open</a>
                </span>
              </div>
            ))}
          </div>
        ) : <p className="stat">None yet.</p>}
        <div className="actions">
          <button className="btn small" onClick={() => api.openOutput()}>📂 Open the output folder</button>
          <button className="btn small ghost" onClick={async () => {
            // Save first: the file on disk can be a second behind this page.
            await api.saveProject(project).catch(() => undefined);
            const r = await api.tidy(project.id).catch(() => ({ removed: 0 }));
            setTidied(r.removed ? 'Removed ' + r.removed + ' old take(s) and replaced picture(s).' : 'Nothing to tidy.');
          }}>🧹 Delete old takes & replaced pictures</button>
          {tidied ? <span className="stat" style={{ alignSelf: 'center' }}>{tidied}</span> : null}
        </div>
      </div>
    </>
  );
};

// ---------------------------------------------------------------------------

const ShortPanel: React.FC<{ running: boolean; onRender: (q: 'draft' | 'full') => void; progress: React.ReactNode }> = ({ running, onRender, progress }) => {
  const { project, update } = useStudio();
  const s = project.short;
  const set = (patch: Partial<typeof s>) => update((p) => ({ ...p, short: { ...p.short, ...patch } }));
  const props = useMemo(() => buildShortTimeline(project), [project]);
  const secs = props.totalFrames / FPS;
  const last = project.scenes.length - 1;

  return (
    <div className="panel">
      <h2>Make a Short</h2>
      <p className="lede">
        Cut a vertical 9:16 Short from a stretch of scenes to promote the full video. Each picture is cropped around its 🎯 camera
        focus, so set the focus on the important part in 🎬 Animate.
      </p>
      <div className="short-grid">
        <div>
          <div className="grid">
            <div className="field">
              <label>From scene</label>
              <select value={s.fromScene} onChange={(e) => set({ fromScene: Number(e.target.value), toScene: Math.max(Number(e.target.value), s.toScene) })}>
                {project.scenes.map((sc, i) => <option key={sc.id} value={i}>{i + 1}. {stripTags(sc.narration).slice(0, 40)}</option>)}
              </select>
            </div>
            <div className="field">
              <label>To scene</label>
              <select value={Math.min(s.toScene, last)} onChange={(e) => set({ toScene: Number(e.target.value) })}>
                {project.scenes.map((sc, i) => (i >= s.fromScene ? <option key={sc.id} value={i}>{i + 1}. {stripTags(sc.narration).slice(0, 40)}</option> : null))}
              </select>
            </div>
          </div>
          <p className="stat" style={{ marginTop: 8 }}>
            <b className={secs > 60 ? 'bad' : ''}>{formatDuration(secs)}</b> long {secs > 60 ? '— Shorts must be under 60 seconds (up to 3 minutes now allowed, but under 60 performs best).' : '— good, under a minute.'}
          </p>
          <div className="field" style={{ marginTop: 12 }}>
            <label>Hook (big text over the first seconds)</label>
            <input className="text" value={s.hook} placeholder={project.title ? project.title + '?' : 'How did they survive 50°C with no electricity?'} onChange={(e) => set({ hook: e.target.value })} />
          </div>
          <div className="field" style={{ marginTop: 12 }}>
            <label>End card</label>
            <input className="text" value={s.endCard} onChange={(e) => set({ endCard: e.target.value })} />
          </div>
          <div className="actions">
            <button className="btn" disabled={running} onClick={() => onRender('draft')}>Draft Short</button>
            <button className="btn primary" disabled={running} onClick={() => onRender('full')}>📱 Render Short (1080×1920)</button>
          </div>
        </div>
        <div className="portrait-screen">
          <Player
            component={HistoryVideo}
            inputProps={props}
            durationInFrames={Math.max(FPS, props.totalFrames)}
            compositionWidth={HEIGHT}
            compositionHeight={WIDTH}
            fps={FPS}
            controls
            style={{ width: '100%', height: '100%' }}
            acknowledgeRemotionLicense
          />
        </div>
      </div>
      {progress}
    </div>
  );
};

// ---------------------------------------------------------------------------

const ThumbnailPanel: React.FC<{ writerKey: string }> = ({ writerKey }) => {
  const { project, update, prefs } = useStudio();
  const t = project.thumbnail;
  const set = (patch: Partial<ThumbnailSettings>) => update((p) => ({ ...p, thumbnail: { ...p.thumbnail, ...patch } }));
  const [busy, setBusy] = useState<'' | 'idea' | 'render'>('');
  const [result, setResult] = useState('');
  const [error, setError] = useState<string | null>(null);

  const withPictures = project.scenes.flatMap((sc, i) => sc.shots.map((sh, k) => ({ sh, label: shotLabel(i, k) }))).filter(({ sh }) => sh.image);
  const chosen = withPictures.find(({ sh }) => sh.id === t.shotId)?.sh || withPictures[0]?.sh;
  const props: ThumbnailProps = {
    image: chosen?.image || '',
    focus: chosen?.focus || { x: 0.5, y: 0.5 },
    text: t.text || project.title || 'Your title here',
    highlight: t.highlight,
    accent: t.accent,
    side: t.side,
    layer: t.useLayer && chosen?.layer?.image ? chosen.layer : null,
  };

  const thumbBody = () => ({ title: project.title, topic: project.topic || stripTags(project.scenes[0]?.narration || '') });

  const idea = async () => {
    setBusy('idea');
    setError(null);
    try {
      const r = await api.thumbnailIdea({ provider: prefs.writer, model: prefs.writer === 'claude' ? prefs.claudeModel : prefs.geminiModel, ...thumbBody() });
      set({ text: r.text, highlight: r.highlight });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  };

  const render = async () => {
    setBusy('render');
    setError(null);
    try {
      const r = await api.renderThumbnail({ projectId: project.id, props });
      setResult(r.url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="panel">
      <h2>Thumbnail</h2>
      <p className="lede">3–4 huge words, one in a loud colour, over the strongest picture. A shot with a 🧍 character puts them big on the other side.</p>
      <div className="screen" style={{ aspectRatio: '16 / 9' }}>
        <Player component={Thumbnail} inputProps={props} durationInFrames={1} compositionWidth={THUMB_W} compositionHeight={THUMB_H} fps={FPS} style={{ width: '100%', height: '100%' }} acknowledgeRemotionLicense />
      </div>
      <div className="grid" style={{ marginTop: 14 }}>
        <div className="field">
          <label>Words</label>
          <input className="text" value={t.text} placeholder={project.title || 'Egypt’s 50°C secret'} onChange={(e) => set({ text: e.target.value })} />
        </div>
        <div className="field">
          <label>Words in colour</label>
          <div className="row" style={{ marginTop: 0 }}>
            <input className="text" value={t.highlight} placeholder="50°C" onChange={(e) => set({ highlight: e.target.value })} />
            <input type="color" value={t.accent} onChange={(e) => set({ accent: e.target.value })} title="Accent colour" />
          </div>
        </div>
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <select value={t.side} onChange={(e) => set({ side: e.target.value as 'left' | 'right' })}>
          <option value="left">Words on the left</option>
          <option value="right">Words on the right</option>
        </select>
        <label className="stat"><input type="checkbox" checked={t.useLayer} onChange={(e) => set({ useLayer: e.target.checked })} /> use the shot’s character</label>
        <button className="btn small" disabled={Boolean(busy) || !writerKey} onClick={idea}>{busy === 'idea' ? <Spinner /> : '✨'} Suggest words</button>
        <button className="btn small primary" disabled={Boolean(busy) || !chosen} onClick={render}>{busy === 'render' ? <><Spinner /> Rendering…</> : '🖼 Save thumbnail PNG'}</button>
        {result ? <a className="btn small" href={result} target="_blank" rel="noreferrer">Open PNG</a> : null}
      </div>
      <ChatbotHelper<{ text: string; highlight: string }> task="thumbnail" body={thumbBody} label="Suggest the words with any chatbot" onResult={(r) => set({ text: r.text, highlight: r.highlight })} />
      <div className="thumb-pick">
        {withPictures.map(({ sh, label }) => (
          <button key={sh.id} className={'shot-tab' + (sh.id === chosen?.id ? ' on' : '')} onClick={() => set({ shotId: sh.id })}>
            <img src={mediaUrl(sh.image)} alt="" />
            <span className="lbl">{label}{sh.layer ? ' 🧍' : ''}</span>
          </button>
        ))}
      </div>
      <ErrorNote error={error} />
    </div>
  );
};
