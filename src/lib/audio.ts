// ---------------------------------------------------------------------------
// Ground-truth measurement of a voiceover clip.
//
// The server can only estimate an mp3's length from its header, and ElevenLabs'
// word timings are measured against the *encoded content*, which is not quite
// the same thing as the decoded file a player actually hears: every mp3 carries
// a few milliseconds of encoder delay at the front.
//
// So we decode each clip in the browser and measure it for real. That gives us
// three numbers we can trust, and sync stops being a guess.
// ---------------------------------------------------------------------------

export interface ClipAnalysis {
  /** Exact decoded length in seconds. */
  duration: number;
  /** When sound actually starts. Includes the mp3 encoder delay. */
  speechStart: number;
  /** When sound actually stops, ignoring trailing silence. */
  speechEnd: number;
}

/** Anything quieter than this counts as silence (about -40 dBFS). */
const SILENCE_RMS = 0.01;
const BLOCK = 512;

let ctx: AudioContext | null = null;

function getContext(): AudioContext {
  // One shared context: browsers cap how many can exist at once.
  if (!ctx) {
    const Ctor: typeof AudioContext =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor();
  }
  return ctx;
}

export async function analyseClip(url: string): Promise<ClipAnalysis | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const bytes = await res.arrayBuffer();
    const buffer = await getContext().decodeAudioData(bytes);

    const data = buffer.getChannelData(0);
    const rate = buffer.sampleRate;

    let firstLoud = -1;
    let lastLoud = -1;

    for (let start = 0; start < data.length; start += BLOCK) {
      const end = Math.min(start + BLOCK, data.length);
      let sum = 0;
      for (let i = start; i < end; i++) sum += data[i] * data[i];
      const rms = Math.sqrt(sum / (end - start));
      if (rms > SILENCE_RMS) {
        if (firstLoud === -1) firstLoud = start;
        lastLoud = end;
      }
    }

    // A clip that is silent all the way through: treat the whole thing as sound
    // rather than reporting a zero-length scene.
    if (firstLoud === -1) {
      return { duration: buffer.duration, speechStart: 0, speechEnd: buffer.duration };
    }

    return {
      duration: buffer.duration,
      speechStart: firstLoud / rate,
      speechEnd: Math.min(buffer.duration, lastLoud / rate),
    };
  } catch {
    // Decoding failed (odd codec, blocked fetch). The caller keeps the server's
    // estimate, which is close enough to still produce a watchable video.
    return null;
  }
}

/**
 * How far the decoded file runs ahead of ElevenLabs' word timings.
 *
 * The alignment says the first word starts at t. In the decoded file the first
 * sound appears at speechStart. The difference is the encoder delay, and adding
 * it to every word timing is what makes the karaoke highlight land on the right
 * syllable instead of a few frames early.
 */
export function captionOffset(analysis: ClipAnalysis, firstWordStart: number | undefined): number {
  if (typeof firstWordStart !== 'number') return 0;
  const delta = analysis.speechStart - firstWordStart;
  // Only ever a small positive nudge; anything larger means our assumption is
  // wrong and we are better off not shifting at all.
  if (!Number.isFinite(delta) || delta <= 0) return 0;
  return Math.min(delta, 0.25);
}
