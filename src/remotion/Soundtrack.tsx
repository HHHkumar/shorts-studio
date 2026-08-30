import React, { useMemo } from 'react';
import { Audio, Sequence, staticFile, useVideoConfig } from 'remotion';
import { buildDuckCurve } from '../lib/mix';
import type { DesignSettings, QuizContent, Scene } from '../lib/types';

/**
 * Music bed and sound effects.
 *
 * The bed loops for the whole video and ducks automatically underneath the
 * narration, so the voice is never fighting the music. Effects are placed on
 * the frames where something actually happens - an option arriving, a second
 * ticking away, the answer landing - rather than sprinkled about.
 */

const SFX_GAIN: Record<string, number> = {
  // The generated sweeps are deliberately quiet, so they get a little back here.
  tick: 0.7,
  chime: 0.9,
  whoosh: 1.6,
  transition: 1.8,
};

const sfxFile = (name: string) => staticFile('audio/sfx-' + name + '.wav');

export const Soundtrack: React.FC<{
  scenes: Scene[];
  design: DesignSettings;
  content: QuizContent;
}> = ({ scenes, design, content }) => {
  const { fps, durationInFrames } = useVideoConfig();

  // One pass over the timeline gives the music level for every frame.
  const duckCurve = useMemo(
    () => buildDuckCurve(scenes, durationInFrames),
    [scenes, durationInFrames],
  );

  const musicSrc = useMemo(() => {
    if (design.music === 'none') return '';
    if (design.music === 'custom') {
      return design.customMusicSrc ? staticFile(design.customMusicSrc.replace(/^\/+/, '')) : '';
    }
    return staticFile('audio/bed-' + design.music + '.wav');
  }, [design.music, design.customMusicSrc]);

  const cues = useMemo(
    () => (design.sfx ? buildCues(scenes, content, fps) : []),
    [scenes, content, fps, design.sfx],
  );

  return (
    <>
      {musicSrc ? (
        <Audio
          src={musicSrc}
          loop
          volume={(f) => design.musicVolume * (duckCurve[Math.min(f, duckCurve.length - 1)] ?? 1)}
        />
      ) : null}

      {cues.map((cue, i) => (
        <Sequence key={i} from={cue.frame} durationInFrames={cue.length} name={'sfx ' + cue.name}>
          <Audio src={sfxFile(cue.name)} volume={design.sfxVolume * (SFX_GAIN[cue.name] ?? 1)} />
        </Sequence>
      ))}
    </>
  );
};

interface Cue {
  name: string;
  frame: number;
  length: number;
}

/** Work out every frame where an effect belongs. */
function buildCues(scenes: Scene[], content: QuizContent, fps: number): Cue[] {
  const cues: Cue[] = [];
  const add = (name: string, frame: number, seconds: number) => {
    if (frame < 0) return;
    cues.push({ name, frame: Math.round(frame), length: Math.max(1, Math.ceil(seconds * fps)) });
  };

  scenes.forEach((scene, index) => {
    // A sweep on every cut except the very first frame of the video.
    if (index > 0) add('transition', scene.startFrame, 0.45);

    if (scene.kind === 'options') {
      // One whoosh per option, on the frame that option slides in. The stagger
      // here must match the one in OptionsBoard.
      content.options.forEach((_, i) => add('whoosh', scene.startFrame + 3 + i * 5, 0.4));
    }

    if (scene.kind === 'countdown') {
      const seconds = Math.floor(scene.durationInFrames / fps);
      for (let s = 0; s < seconds; s++) add('tick', scene.startFrame + s * fps, 0.2);
    }

    if (scene.kind === 'answer') {
      // Lands with the row turning green, a few frames into the reveal.
      add('chime', scene.startFrame + 3, 1.2);
    }
  });

  return cues;
}
