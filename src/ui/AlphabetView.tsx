import React, { useEffect, useRef, useState } from 'react';
import { Player } from '@remotion/player';
import { api, type VarnamaleJob, type VarnamaleStatus, type VoiceModel, type VoiceOption, type VoiceSettings } from '../lib/api';
import { buildTimeline, LETTERS, totalFrames } from '../lib/varnamale';
import { Varnamale } from '../remotion/Varnamale';
import { Check, ErrorNote, Note, Select, Spinner, TextInput } from './controls';

// ---------------------------------------------------------------------------
// The Kannada alphabet video, as a page of the app.
//
// It was a command-line tool. The video has nothing to write - the 49 letters
// of the school varnamale, as a chart, read aloud one at a time - so the page
// is three things: the voice it is read in, a live preview, and a render.
// Recording is per voice and model and keeps every clip that is still current,
// so changing nothing and pressing Record again costs nothing.
// ---------------------------------------------------------------------------

const FPS = 30;
/** How often a running job is asked how it is doing. */
const POLL_MS = 800;

export const AlphabetView: React.FC<{
  elevenKey: string;
  voiceModels: VoiceModel[];
  settings: VoiceSettings;
  onClose: () => void;
}> = ({ elevenKey, voiceModels, settings, onClose }) => {
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [voiceId, setVoiceId] = useState(settings.voiceId);
  // Kannada needs a model that speaks it: v2 and Flash read it with the wrong accent.
  const models = voiceModels.filter((m) => m.indic);
  const choices = models.length ? models : [{ id: 'eleven_v4', label: 'Eleven v4', style: false, speed: false, indic: true }];
  const [modelId, setModelId] = useState(choices.some((m) => m.id === settings.modelId) ? settings.modelId : choices[0].id);
  const [status, setStatus] = useState<VarnamaleStatus | null>(null);
  const [job, setJob] = useState<VarnamaleJob | null>(null);
  const [redo, setRedo] = useState('');
  const [music, setMusic] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);

  // Set on every mount: React mounts twice in development, and a flag only
  // ever cleared would leave the page deaf to every answer after the first.
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const refresh = () =>
    api.varnamaleStatus(voiceId, modelId).then((s) => { if (alive.current) setStatus(s); }).catch((e) => setError(e instanceof Error ? e.message : String(e)));

  useEffect(() => { void refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [voiceId, modelId]);

  useEffect(() => {
    if (elevenKey.trim().length < 6) return;
    api.voices(elevenKey.trim())
      .then((list) => {
        if (!alive.current) return;
        setVoices(list);
        if (!voiceId && list.length) setVoiceId(list[0].id);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elevenKey]);

  /** Follow a job until it ends, then read the status again. */
  const follow = async (jobId: string) => {
    for (;;) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      if (!alive.current) return;
      const now = await api.varnamaleJob(jobId);
      setJob(now);
      if (now.status !== 'running') {
        if (now.status === 'error') setError(now.error);
        await refresh();
        return;
      }
    }
  };

  const start = async (kind: 'voice' | 'render') => {
    setError(null);
    try {
      const { jobId } = kind === 'voice'
        ? await api.varnamaleVoice({ apiKey: elevenKey.trim(), voiceId, modelId, redo }, status ? status.toSend : 0)
        : await api.varnamaleRender(music);
      setJob({ kind, status: 'running', done: 0, total: 0, stage: 'Starting…', progress: 0, error: '', url: '' });
      await follow(jobId);
      if (kind === 'voice') setRedo('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const running = Boolean(job && job.status === 'running');
  const noKey = elevenKey.trim().length < 6;
  const clips = status ? status.clips : null;
  const frames = Math.max(1, totalFrames(buildTimeline(clips, FPS)));
  const allCurrent = Boolean(status && status.current === status.lines);
  const voiceName = (voices.find((v) => v.id === voiceId) || { name: settings.voiceName || 'this voice' }).name;

  return (
    <div className="panel alphabet-view">
      <div className="actions" style={{ marginTop: 0 }}>
        <h2 style={{ margin: 0 }}>Kannada alphabet — ಕನ್ನಡ ವರ್ಣಮಾಲೆ</h2>
        <div className="spacer" />
        <button className="btn ghost" onClick={onClose}>Back to the video</button>
      </div>
      <p className="lede">
        All {LETTERS.length} letters of the school varnamale on one 16:9 chart — vowels, yogavahas, the five
        vargas and the ungrouped consonants — each lit in its group&rsquo;s colour while the voice says it.
        Every letter is its own recording, so it stays lit exactly as long as it is spoken.
      </p>

      <ErrorNote error={error} />

      <div className="grid">
        <Select
          label="Voice"
          value={voiceId}
          options={voices.length ? voices.map((v) => ({ id: v.id, label: v.name })) : [{ id: voiceId, label: settings.voiceName || (noKey ? 'Add an ElevenLabs key on step 1' : 'Loading voices…') }]}
          onChange={setVoiceId}
          disabled={running || !voices.length}
          hint="One video in one voice: changing it records every letter again."
        />
        <Select
          label="Voice model"
          value={modelId}
          options={choices.map((m) => ({ id: m.id, label: m.label }))}
          onChange={setModelId}
          disabled={running}
          hint="Only the models that speak Kannada properly are offered."
        />
      </div>

      {status ? (
        <Note kind={allCurrent ? 'good' : 'info'} title={allCurrent ? 'The voice is recorded' : status.current ? 'Part of the voice is recorded' : 'No voice in ' + voiceName + ' yet'}>
          {status.current} of {status.lines} lines are recorded in {voiceName} with this model
          {status.recorded > status.current ? ' (' + (status.recorded - status.current) + ' more in another voice or model, recorded again on the next press)' : ''}.
          {' '}The video runs {status.seconds.toFixed(0)} seconds{clips ? '' : ', silent at fixed timings until the voice is recorded'}.
          {status.toSend ? ' Recording the rest sends about ' + status.toSend.toLocaleString() + ' characters to ElevenLabs.' : ''}
        </Note>
      ) : null}

      <div className="grid" style={{ marginTop: 12 }}>
        <TextInput
          label="Record these letters again"
          value={redo}
          onChange={setRedo}
          placeholder="ಕ, ಖ   or   ka, kha   or   all"
          hint="For a letter the voice said wrongly. Left empty, only what is missing or out of date is recorded."
        />
        <Check label="Music under the voice" hint="The calm bed, very low." checked={music} onChange={setMusic} />
      </div>

      {running && job ? (
        <>
          <div className="bar"><div style={{ width: Math.max(3, job.progress * 100) + '%' }} /></div>
          <div className="progress-line"><span><Spinner /> {job.stage}</span><span>{job.total ? job.done + ' / ' + job.total : ''}</span></div>
        </>
      ) : null}

      <div className="actions">
        <button className="btn" disabled={running || noKey || !voiceId || (allCurrent && !redo.trim())} onClick={() => start('voice')}>
          🎙️ {allCurrent && !redo.trim() ? 'Voice is up to date' : redo.trim() ? 'Record those letters again' : 'Record the voice'}
        </button>
        <button className="btn primary" disabled={running} onClick={() => start('render')}>
          🎬 Render the video
        </button>
        {status && status.video ? (
          <a className="btn ghost" href={status.video.url} target="_blank" rel="noreferrer">
            ▶ Open the last render ({new Date(status.video.at).toLocaleString()})
          </a>
        ) : null}
      </div>
      {job && job.status === 'done' && job.kind === 'render' ? (
        <p className="hint">Saved as <b>out\kannada-varnamale.mp4</b>, 1920 × 1080.</p>
      ) : null}

      <div className="alphabet-preview">
        <Player
          component={Varnamale}
          inputProps={{ clips, music }}
          durationInFrames={frames}
          fps={FPS}
          compositionWidth={1920}
          compositionHeight={1080}
          style={{ width: '100%', height: '100%' }}
          controls
          numberOfSharedAudioTags={10}
          acknowledgeRemotionLicense
        />
      </div>
      <div className="preview-meta">
        <span>Live preview · 1920 × 1080</span>
        <span>{(frames / FPS).toFixed(1)} s</span>
      </div>
    </div>
  );
};
