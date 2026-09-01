import React, { useEffect, useRef, useState } from 'react';
import { api, type VoiceOption, type VoiceSettings } from '../lib/api';
import { analyseClip, captionOffset } from '../lib/audio';
import { trueDuration, type AudioResult } from '../lib/timeline';
import type { QuizContent } from '../lib/types';
import { ErrorNote, Note, Select, Slider, Spinner } from './controls';

export const StepVoice: React.FC<{
  elevenKey: string;
  content: QuizContent;
  settings: VoiceSettings;
  setSettings: (updater: (prev: VoiceSettings) => VoiceSettings) => void;
  voiceModels: { id: string; label: string }[];
  audio: Record<number, AudioResult>;
  onAudio: (tracks: Record<number, AudioResult>) => void;
  onBack: () => void;
  onNext: () => void;
}> = ({ elevenKey, content, settings, setSettings, voiceModels, audio, onAudio, onBack, onNext }) => {
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const previewRef = useRef<HTMLAudioElement | null>(null);

  const spokenLines = content.script.filter((s) => s.narration.trim()).length;
  const characters = content.script.reduce((n, s) => n + s.narration.trim().length, 0);
  const haveAudio = Object.keys(audio).length > 0;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await api.voices(elevenKey.trim());
        if (cancelled) return;
        setVoices(list);
        // Pick a sensible default the first time.
        if (!settings.voiceId && list.length) {
          const preferred = list.find((v) => /rachel|adam|brian|george|bill/i.test(v.name)) || list[0];
          setSettings((p) => ({ ...p, voiceId: preferred.id, voiceName: preferred.name }));
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoadingVoices(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elevenKey]);

  const selected = voices.find((v) => v.id === settings.voiceId);

  const playPreview = () => {
    if (!selected || !selected.previewUrl) return;
    if (previewRef.current) previewRef.current.pause();
    const el = new Audio(selected.previewUrl);
    previewRef.current = el;
    el.play().catch(() => setError('Your browser blocked the preview sound. Click anywhere on the page and try again.'));
  };

  const record = async () => {
    setBusy(true);
    setError(null);
    setDone(0);
    setStage('Sending the script to ElevenLabs…');
    try {
      const { jobId, total: t } = await api.startVoiceover(elevenKey.trim(), settings, content.script);
      setTotal(t);

      // Poll until every line is recorded.
      for (;;) {
        await new Promise((r) => setTimeout(r, 700));
        const status = await api.voiceoverStatus(jobId);
        setDone(status.done);
        setTotal(status.total);
        setStage(status.stage);
        if (status.status === 'error') throw new Error(status.error);
        if (status.status === 'done') {
          const tracks: Record<number, AudioResult> = {};
          Object.entries(status.tracks).forEach(([k, v]) => {
            tracks[Number(k)] = v;
          });

          // The server could only estimate each clip's length from its mp3
          // header. Decode them for real so the timeline is built on measured
          // audio rather than an estimate - this is what locks sync.
          setStage('Measuring the clips for exact sync…');
          await Promise.all(
            Object.values(tracks).map(async (track) => {
              const analysis = await analyseClip('/' + track.src);
              if (!analysis) return;
              track.measuredDuration = analysis.duration;
              track.speechStart = analysis.speechStart;
              track.speechEnd = analysis.speechEnd;
              track.captionOffset = captionOffset(analysis, track.words[0]?.start);
            }),
          );

          onAudio(tracks);
          break;
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const totalAudioSeconds = Object.values(audio).reduce((n, a) => n + trueDuration(a), 0);
  const measuredCount = Object.values(audio).filter((a) => typeof a.measuredDuration === 'number').length;

  return (
    <div className="panel">
      <h2>Step 4 — Give it a voice</h2>
      <p className="lede">
        ElevenLabs reads your script. Each scene is recorded as its own clip, and the video is then
        built around those exact lengths — that is what keeps the picture and the sound locked together.
      </p>

      <ErrorNote error={error} />

      {loadingVoices ? (
        <Note kind="info">
          <Spinner /> Loading the voices on your ElevenLabs account…
        </Note>
      ) : voices.length === 0 ? (
        <Note kind="warn" title="No voices found">
          Your ElevenLabs account has no voices yet. Open{' '}
          <a href="https://elevenlabs.io/app/voice-library" target="_blank" rel="noreferrer">
            the Voice Library
          </a>
          , add any voice to your account, then come back and refresh this page.
        </Note>
      ) : (
        <>
          <div className="grid">
            <Select
              label="Voice"
              value={settings.voiceId}
              options={voices.map((v) => ({
                id: v.id,
                label: v.name + (v.description ? ' — ' + v.description : ''),
              }))}
              onChange={(id) => {
                const v = voices.find((x) => x.id === id);
                setSettings((p) => ({ ...p, voiceId: id, voiceName: v ? v.name : '' }));
              }}
              hint="These are the voices on your own ElevenLabs account."
            />
            <Select
              label="Voice model"
              value={settings.modelId}
              options={voiceModels}
              onChange={(id) => setSettings((p) => ({ ...p, modelId: id }))}
              hint="Multilingual v2 sounds best. Flash costs the least."
            />
          </div>

          <div className="actions" style={{ marginTop: 14 }}>
            <button className="btn" onClick={playPreview} disabled={!selected || !selected.previewUrl}>
              ▶ Hear this voice
            </button>
          </div>

          <details className="help">
            <summary>Fine-tune the delivery (optional)</summary>
            <div className="inner">
              <div className="grid" style={{ marginTop: 12 }}>
                <Slider
                  label="Stability"
                  value={settings.stability}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(v) => setSettings((p) => ({ ...p, stability: v }))}
                  hint="Low = more emotional and variable. High = flat and consistent."
                />
                <Slider
                  label="Similarity"
                  value={settings.similarity}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(v) => setSettings((p) => ({ ...p, similarity: v }))}
                  hint="How closely it copies the original voice."
                />
                <Slider
                  label="Style exaggeration"
                  value={settings.style}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(v) => setSettings((p) => ({ ...p, style: v }))}
                  hint="Higher is more theatrical. Above 0.6 can sound unstable."
                />
                <Slider
                  label="Speaking speed"
                  value={settings.speed}
                  min={0.8}
                  max={1.2}
                  step={0.05}
                  suffix="x"
                  onChange={(v) => setSettings((p) => ({ ...p, speed: v }))}
                  hint="1.05–1.1 suits short-form video. Not every model supports this."
                />
              </div>
            </div>
          </details>

          <Note kind="info" title="What this will cost">
            {spokenLines} lines, {characters.toLocaleString()} characters. ElevenLabs charges roughly one
            credit per character, so this is about {characters.toLocaleString()} credits.
          </Note>

          <Note kind="info" title="Units are spoken in full">
            Left alone, the voice reads <b>10 MW</b> as “ten mili wag”. Any unit symbol with a number
            in front of it — MW, kV, kWh, Hz, Ω, °C — is expanded for the voice only, so it says
            “ten megawatts” while the screen keeps <b>10 MW</b>. Write units however you normally
            would; a symbol with no number before it is never touched.
          </Note>

          {busy ? (
            <>
              <div className="bar">
                <div style={{ width: (total ? (done / total) * 100 : 5) + '%' }} />
              </div>
              <div className="progress-line">
                <span>{stage}</span>
                <span>
                  {done} / {total}
                </span>
              </div>
            </>
          ) : null}

          {haveAudio && !busy ? (
            <>
              <Note kind="good" title="Voiceover ready and measured">
                {Object.keys(audio).length} clips, {totalAudioSeconds.toFixed(1)} seconds of speech in total.
                {measuredCount === Object.keys(audio).length
                  ? ' Every clip was decoded and measured exactly, so the picture is locked to the sound.'
                  : ' ' + measuredCount + ' of ' + Object.keys(audio).length +
                    ' clips could be measured exactly; the rest fall back to the file estimate.'}
              </Note>

              <details className="help">
                <summary>Show the sync report</summary>
                <div className="inner">
                  <div className="table-scroll">
                    <table className="sync">
                      <thead>
                        <tr>
                          <th>Scene</th>
                          <th>Clip length</th>
                          <th>Speech ends</th>
                          <th>Caption nudge</th>
                        </tr>
                      </thead>
                      <tbody>
                        {content.script.map((line, i) => {
                          const track = audio[i];
                          if (!track) {
                            return (
                              <tr key={i}>
                                <td>{line.kind}</td>
                                <td colSpan={3} className="quiet">silent</td>
                              </tr>
                            );
                          }
                          return (
                            <tr key={i}>
                              <td>{line.kind}</td>
                              <td className="num">{trueDuration(track).toFixed(2)}s</td>
                              <td className="num">
                                {typeof track.speechEnd === 'number' ? track.speechEnd.toFixed(2) + 's' : '—'}
                              </td>
                              <td className="num">
                                {track.captionOffset ? '+' + Math.round(track.captionOffset * 1000) + 'ms' : '0'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p style={{ marginTop: 10 }}>
                    Each scene is made exactly as long as its own clip, rounded up, so a line can never
                    be cut off. The caption nudge cancels the few milliseconds of silence every mp3
                    carries at its start, which is what puts the highlighted word on the right syllable.
                  </p>
                </div>
              </details>
            </>
          ) : null}

          <div className="actions">
            <button className="btn ghost" onClick={onBack} disabled={busy}>
              ← Back to the script
            </button>
            <div className="spacer" />
            <button className="btn" onClick={record} disabled={busy || !settings.voiceId}>
              {busy ? <Spinner /> : '🎙️'} {haveAudio ? 'Record again' : 'Make the voiceover'}
            </button>
            <button className="btn primary" onClick={onNext} disabled={busy || !haveAudio}>
              Continue →
            </button>
          </div>

          {!haveAudio && !busy ? (
            <div className="hint" style={{ marginTop: 10, color: 'var(--dim)' }}>
              Record the voiceover to continue. (You can still change the look afterwards without
              re-recording.)
            </div>
          ) : null}
        </>
      )}
    </div>
  );
};
