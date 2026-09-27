import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { framesToClock } from '../lib/timeline';
import type { VideoProps } from '../lib/types';
import { ErrorNote, Note, Select, Spinner } from './controls';

export const StepExport: React.FC<{
  props: VideoProps;
  hasAudio: boolean;
  onBack: () => void;
  onNewQuestion: () => void;
  onReset: () => void;
  /** Ties the finished file to this video in the library. */
  videoId: string;
}> = ({ props, hasAudio, onBack, onNewQuestion, onReset, videoId }) => {
  const [quality, setQuality] = useState('medium');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // Renders the helper was in the middle of when it stopped: one press runs them again.
  const [interrupted, setInterrupted] = useState<{ jobId: string; title: string; at: string }[]>([]);

  useEffect(() => {
    api.renders()
      .then((r) => setInterrupted(r.renders.filter((j) => j.status === 'interrupted')))
      .catch(() => setInterrupted([]));
  }, []);

  const { content, totalDurationInFrames, fps } = props;

  /** Start a render (or re-run an interrupted one) and follow it to the end. */
  const run = async (start: () => Promise<{ jobId: string }>) => {
    setBusy(true);
    setError(null);
    setVideoUrl('');
    setProgress(0);
    setStage('Starting…');
    try {
      const { jobId } = await start();
      for (;;) {
        await new Promise((r) => setTimeout(r, 900));
        const status = await api.renderStatus(jobId);
        setProgress(status.progress || 0);
        setStage(status.stage || '');
        if (status.status === 'error') throw new Error(status.error);
        if (status.status === 'done') {
          // Cache-bust so a re-render never shows the previous file.
          setVideoUrl(status.url + '?t=' + Date.now());
          break;
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const render = () => run(() => api.startRender(props, quality, videoId));
  const retry = (jobId: string) => {
    setInterrupted((list) => list.filter((j) => j.jobId !== jobId));
    return run(() => api.retryRender(jobId));
  };

  // Pexels and NASA do not require attribution, but crediting them is good
  // manners and costs nothing in a description box.
  const credits = Array.from(
    new Set((content.script || []).map((s) => s.stockCredit).filter(Boolean)),
  );

  const caption =
    content.question +
    '\n\n' +
    (content.funFact ? content.funFact + '\n\n' : '') +
    (content.hashtags || []).map((h) => '#' + h.replace(/^#/, '')).join(' ') +
    (credits.length ? '\n\nImages: ' + credits.join(', ') : '');

  const copyCaption = async () => {
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Your browser blocked the clipboard. Select the text below and copy it manually.');
    }
  };

  return (
    <div className="panel">
      <h2>Step 6 — Make the video file</h2>
      <p className="lede">
        This draws all {totalDurationInFrames} frames and encodes them into an MP4 you can upload
        straight to YouTube Shorts, Reels or TikTok.
      </p>

      {!hasAudio ? (
        <Note kind="warn" title="No voiceover yet">
          You can still render, but the video will be silent and the scene lengths are only estimates.
          Go back to step 4 to record the voice.
        </Note>
      ) : null}

      <div className="grid">
        <Select
          label="Quality"
          value={quality}
          options={[
            { id: 'medium', label: 'Normal — good quality, fast (recommended)' },
            { id: 'high', label: 'High — sharper, bigger file, slower' },
            { id: 'low', label: 'Draft — quick check, visibly softer' },
          ]}
          onChange={setQuality}
        />
        <div className="field">
          <label>Video details</label>
          <div className="hint" style={{ fontSize: 14, lineHeight: 1.8 }}>
            1080 × 1920 (9:16) · {fps} fps · {framesToClock(totalDurationInFrames, fps)} long ·{' '}
            {props.scenes.length} scenes
          </div>
        </div>
      </div>

      <Note kind="info" title="The first render is the slow one">
        The very first time you render, the tool downloads and prepares its rendering browser. That can
        take a few minutes. Every render after that starts in seconds. Keep this tab open while it works.
      </Note>

      {interrupted.length && !busy ? (
        <Note kind="warn" title={interrupted.length === 1 ? 'A render was interrupted' : interrupted.length + ' renders were interrupted'}>
          The helper stopped part way through. Each can be run again exactly as it was.
          {interrupted.map((j) => (
            <div key={j.jobId} style={{ marginTop: 6 }}>
              <button className="link-btn" onClick={() => retry(j.jobId)}>Render again</button>{' '}
              {j.title ? '“' + j.title.slice(0, 70) + '”' : j.jobId}
            </div>
          ))}
        </Note>
      ) : null}

      <ErrorNote error={error} />

      {busy ? (
        <>
          <div className="bar">
            <div style={{ width: Math.max(3, progress * 100) + '%' }} />
          </div>
          <div className="progress-line">
            <span>{stage}</span>
            <span>{Math.round(progress * 100)}%</span>
          </div>
        </>
      ) : null}

      {videoUrl ? (
        <>
          <Note kind="good" title="Your video is ready 🎉">
            It is also saved on your computer inside the <span className="kbd">shorts-studio/out</span>{' '}
            folder.
          </Note>
          <video className="videobox" src={videoUrl} controls playsInline />
          <div className="actions">
            <a className="btn primary" href={videoUrl} download>
              ⬇ Download the MP4
            </a>
            <button className="btn" onClick={copyCaption}>
              {copied ? '✓ Copied' : '📋 Copy the caption & hashtags'}
            </button>
          </div>
          <details className="help">
            <summary>Show the caption text</summary>
            <div className="inner">
              <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{caption}</pre>
            </div>
          </details>
        </>
      ) : null}

      <div className="actions">
        <button className="btn ghost" onClick={onBack} disabled={busy}>
          ← Change the look
        </button>
        <div className="spacer" />
        <button className="btn primary big" style={{ width: 'auto' }} onClick={render} disabled={busy}>
          {busy ? <Spinner /> : '🎬'} {videoUrl ? 'Render again' : 'Render the video'}
        </button>
      </div>

      <div className="section-title">Start something new</div>
      <div className="actions" style={{ marginTop: 0 }}>
        <button className="btn" onClick={onNewQuestion} disabled={busy}>
          ✨ New question, same style
        </button>
        <div className="spacer" />
        <button
          className="btn danger"
          disabled={busy}
          onClick={() => {
            if (confirm('This clears your API keys, settings and the current question. Continue?')) onReset();
          }}
        >
          Reset everything
        </button>
      </div>
    </div>
  );
};
