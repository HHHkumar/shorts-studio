// ---------------------------------------------------------------------------
// Everything you hear except the narration.
//
//   music      loops under the whole video and DUCKS under the voice: it dips
//              to 40% while someone is speaking and swells back in the gaps and
//              under chapter cards, the way a documentary editor would ride it.
//   ambience   a matching loop under scenes with an atmosphere effect - wind
//              over heat haze, crackle under embers, rain under rain.
//   effects    a whoosh on the showier transitions, a pop on each callout, a
//              low hit on each chapter card.
//
// All the audio files are synthesised on this machine (server/audio-gen.mjs),
// so there is no licensing question about any of it.
// ---------------------------------------------------------------------------

import React, { useMemo } from 'react';
import { Audio, interpolate, Sequence, useVideoConfig } from 'remotion';
import type { Design, Effect, MusicSegment, TimedScene } from '../lib/types';
import { resolveSrc } from './media';
import { WHOOSHES } from './Transitions';

const AMBIENCE: Partial<Record<Effect, string>> = {
  heat: 'audio/amb-wind.wav',
  dust: 'audio/amb-wind.wav',
  fog: 'audio/amb-wind.wav',
  snow: 'audio/amb-wind.wav',
  embers: 'audio/amb-fire.wav',
  flicker: 'audio/amb-fire.wav',
  rain: 'audio/amb-rain.wav',
  breeze: 'audio/amb-wind.wav',
};

/** Per-frame music gain, 0.4 under speech and 1 elsewhere, with short ramps. */
function duckCurve(scenes: TimedScene[], total: number, fps: number): Float32Array {
  const speaking = new Uint8Array(total);
  for (const s of scenes) {
    const a = s.startFrame + s.leadIn;
    const b = Math.min(total, a + s.voiceFrames);
    for (let f = Math.max(0, a); f < b; f++) speaking[f] = 1;
  }
  // Ramp: look a few frames ahead (dip before the first word) and behind (recover after the last).
  const ramp = Math.round(fps * 0.3);
  const out = new Float32Array(total);
  let level = 1;
  for (let f = 0; f < total; f++) {
    const soon = speaking[Math.min(total - 1, f + Math.round(ramp / 2))];
    const target = speaking[f] || soon ? 0.4 : 1;
    level += (target - level) / ramp * 2.2;
    out[f] = Math.max(0.4, Math.min(1, level));
  }
  return out;
}

export const Soundtrack: React.FC<{ scenes: TimedScene[]; design: Design; total: number; music: MusicSegment[] }> = ({ scenes, design, total, music }) => {
  const { fps } = useVideoConfig();
  const duck = useMemo(() => (design.duck ? duckCurve(scenes, total, fps) : null), [design.duck, scenes, total, fps]);
  const sfx = design.sfxVolume;
  // Chapter tracks overlap by this much and crossfade; the first fades up from silence, the last out to it.
  const blend = Math.round(fps * 1.5);

  return (
    <>
      {design.musicVolume > 0 ? music.map((m, i) => {
        const first = i === 0;
        const last = i === music.length - 1;
        const from = Math.max(0, m.from - (first ? 0 : blend));
        const to = Math.min(total, m.to + (last ? 0 : blend));
        const len = Math.max(2, to - from);
        const inLen = first ? Math.min(fps * 2, len / 3) : Math.min(blend * 2, len / 2);
        const outLen = last ? Math.min(fps * 2, len / 3) : Math.min(blend * 2, len / 2);
        return (
          <Sequence key={'m' + i + m.src} from={from} durationInFrames={len} layout="none">
            <Audio
              src={resolveSrc(m.src)}
              loop
              volume={(f) => design.musicVolume
                * (duck ? duck[Math.min(total - 1, Math.max(0, from + f))] : 1)
                * interpolate(f, [0, inLen, Math.max(inLen + 1, len - outLen), len], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}
            />
          </Sequence>
        );
      }) : null}

      {design.ambienceVolume > 0 ? scenes.map((s) => {
        const src = AMBIENCE[s.effect];
        if (!src) return null;
        const len = s.durationInFrames;
        const edge = Math.min(fps * 0.6, len / 3);
        return (
          <Sequence key={'amb' + s.id} from={s.startFrame} durationInFrames={len} layout="none">
            <Audio src={resolveSrc(src)} loop volume={(f) => design.ambienceVolume * interpolate(f, [0, edge, len - edge, len], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} />
          </Sequence>
        );
      }) : null}

      {sfx > 0 ? scenes.map((s, i) => (
        <React.Fragment key={'fx' + s.id}>
          {i > 0 && WHOOSHES.includes(s.transition) ? (
            <Sequence from={Math.max(0, s.startFrame - 4)} durationInFrames={fps * 2} layout="none">
              <Audio src={resolveSrc('audio/sfx-whoosh.wav')} volume={sfx * 0.7} />
            </Sequence>
          ) : null}
          {s.chapter ? (
            <Sequence from={s.startFrame + 2} durationInFrames={fps * 3} layout="none">
              <Audio src={resolveSrc('audio/sfx-thud.wav')} volume={sfx * 0.9} />
            </Sequence>
          ) : null}
          {s.callouts.map((c) => (
            <Sequence key={c.id} from={s.startFrame + c.at} durationInFrames={fps * 2} layout="none">
              <Audio src={resolveSrc(c.kind === 'counter' || c.kind === 'thermometer' ? 'audio/sfx-rise.wav' : c.kind === 'route' ? 'audio/sfx-shimmer.wav' : 'audio/sfx-pop.wav')} volume={sfx * 0.55} />
            </Sequence>
          ))}
          {s.beats.filter((b) => b.kind === 'pop').map((b) => (
            <Sequence key={'pop' + b.at} from={s.startFrame + b.at} durationInFrames={fps} layout="none">
              <Audio src={resolveSrc('audio/sfx-pop.wav')} volume={sfx * 0.3} />
            </Sequence>
          ))}
        </React.Fragment>
      )) : null}
    </>
  );
};
