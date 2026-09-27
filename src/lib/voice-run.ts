// ---------------------------------------------------------------------------
// Record a voiceover and measure it: shared by the Voice step and the batch
// runner, so a video made overnight is voiced exactly as one made by hand.
//
// ElevenLabs records each scene; the server can only estimate each clip's
// length from its mp3 header, so every clip is then decoded here, in the
// browser, and measured for real - its exact length, where speech starts and
// stops, and the encoder delay to cancel. That measurement is what locks the
// picture to the sound.
// ---------------------------------------------------------------------------

import { api, type VoiceSettings } from './api';
import { analyseClip, captionOffset } from './audio';
import type { AudioResult } from './timeline';
import type { ScriptLine } from './types';

export interface VoiceProgress {
  done: number;
  total: number;
  stage: string;
}

/**
 * Record the script (or just the scenes in `only`), measure every clip, and
 * return the clips keyed by scene. Throws with ElevenLabs' own message on
 * failure.
 */
export async function recordVoice(
  elevenKey: string,
  settings: VoiceSettings,
  script: ScriptLine[],
  only: number[] | undefined,
  onProgress: (p: VoiceProgress) => void = () => undefined,
): Promise<Record<number, AudioResult>> {
  onProgress({ done: 0, total: 0, stage: 'Sending the script to ElevenLabs…' });
  const { jobId, total } = await api.startVoiceover(elevenKey.trim(), settings, script, only);
  onProgress({ done: 0, total, stage: 'Recording…' });

  for (;;) {
    await new Promise((r) => setTimeout(r, 700));
    const status = await api.voiceoverStatus(jobId);
    onProgress({ done: status.done, total: status.total, stage: status.stage });
    if (status.status === 'error') throw new Error(status.error);
    if (status.status !== 'done') continue;

    const tracks: Record<number, AudioResult> = {};
    Object.entries(status.tracks).forEach(([k, v]) => {
      tracks[Number(k)] = v;
    });
    onProgress({ done: status.done, total: status.total, stage: 'Measuring the clips for exact sync…' });
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
    return tracks;
  }
}
