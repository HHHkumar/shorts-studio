import type { Scene } from './types';

/**
 * The music level for every frame of the video.
 *
 * Wherever a scene has narration the bed drops away underneath it and eases
 * back afterwards, so the voice is never competing with the music. Kept here
 * rather than inside the component so it can be tested on its own.
 */

/** How far the music drops while someone is speaking (0.62 ≈ -8.4 dB). */
export const DUCK_DEPTH = 0.62;
/** Frames spent easing into and out of the duck. */
export const DUCK_RAMP = 10;

export function buildDuckCurve(scenes: Scene[], durationInFrames: number): Float32Array {
  const curve = new Float32Array(Math.max(1, durationInFrames)).fill(1);

  for (const scene of scenes) {
    if (!scene.audioSrc) continue;
    const from = scene.startFrame;
    const to = scene.startFrame + scene.durationInFrames;

    for (let f = from - DUCK_RAMP; f < to + DUCK_RAMP; f++) {
      if (f < 0 || f >= curve.length) continue;
      const easeIn = clamp01((f - (from - DUCK_RAMP)) / DUCK_RAMP);
      const easeOut = clamp01((to + DUCK_RAMP - f) / DUCK_RAMP);
      curve[f] = Math.min(curve[f], 1 - DUCK_DEPTH * Math.min(easeIn, easeOut));
    }
  }

  return curve;
}

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));
