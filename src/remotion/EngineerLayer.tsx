import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Theme } from '../lib/theme';
import type { DesignSettings, Scene } from '../lib/types';
import { poseFor, stagingFor } from '../lib/doodle';
import { ease, mimesIn, type Beat } from '../lib/engineer-rig';
import type { TimedEffect } from '../lib/motion-lexicon';
import { Engineer } from './Engineer';
import { DoodleInk } from './DoodleInk';

// ---------------------------------------------------------------------------
// The animated engineer, across the whole video.
//
// One layer for the video rather than one engineer per scene. Scenes cross-
// fade into each other, and two engineers fading across a cut - one leaving,
// one arriving in a different pose - read as a double exposure. One engineer
// who simply changes pose at the cut reads as a character. So he lives
// outside every scene: he takes up each scene's pose as it starts, acts out
// its action words, slides aside when the scene has a drawing to stand
// beside, and fades out only for the scenes he is not in.
//
// Where he stands is the picture half of the frame, as DoodleStage lays it
// out: below the words in portrait, right of them in landscape.
// ---------------------------------------------------------------------------

/** Frames to fade him in or out over, and to slide him aside over. */
const FADE = 10;
const SLIDE = 18;

interface Spot {
  /** Centre of his box, as a fraction of the frame width. */
  x: number;
  /** Top of his box, and its height, as fractions of the frame height. */
  top: number;
  height: number;
}

/** Alone, centred in the picture half; with a drawing, to one side of it. */
const SPOTS: Record<'portrait' | 'landscape', { alone: Spot; beside: Spot }> = {
  portrait: {
    alone: { x: 0.5, top: 0.495, height: 0.45 },
    beside: { x: 0.27, top: 0.495, height: 0.45 },
  },
  landscape: {
    alone: { x: 0.77, top: 0.1, height: 0.8 },
    beside: { x: 0.66, top: 0.1, height: 0.8 },
  },
};

export const EngineerLayer: React.FC<{
  theme: Theme;
  scenes: Scene[];
  design: DesignSettings;
}> = ({ theme, scenes, design }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const orientation = width > height ? 'landscape' : 'portrait';
  const motion = design.motionStrength ?? 1;

  const plan = React.useMemo(() => {
    const staged = scenes.map((s) => stagingFor(s, design.showVisuals, true));
    const beats: Beat[] = [];
    const mimes: TimedEffect[] = [];
    scenes.forEach((scene, i) => {
      if (!staged[i].engineer) return;
      const start = scene.startFrame / fps;
      beats.push({ at: start, pose: poseFor(scene.doodle, scene.kind) });
      // Paced scene by scene, as the effects are, then placed in the video.
      const seconds = scene.durationInFrames / fps;
      for (const m of mimesIn(scene.words || [], seconds)) {
        mimes.push({ ...m, at: m.at + start + (scene.captionOffset || 0) });
      }
    });
    return { staged, beats, mimes };
  }, [scenes, design.showVisuals, fps]);

  if (!plan.beats.length) return null;

  // The scene under way, and the one before it.
  let now = 0;
  scenes.forEach((s, i) => { if (frame >= s.startFrame) now = i; });
  const before = now > 0 ? now - 1 : -1;
  const here = plan.staged[now];
  const was = before >= 0 ? plan.staged[before] : null;
  const into = frame - scenes[now].startFrame;

  const shown = (st: typeof here | null) => (st && st.engineer ? 1 : 0);
  const opacity = shown(was) + (shown(here) - shown(was)) * Math.min(1, into / FADE);
  if (opacity <= 0) return null;

  // Aside or centred: slides between the two when both scenes have him, and
  // simply stands in place when he has just faded in.
  const spots = SPOTS[orientation];
  const spotOf = (st: typeof here) => (st.beside ? spots.beside : spots.alone);
  const to = here.engineer ? spotOf(here) : spotOf(was || here);
  const from = was && was.engineer && here.engineer ? spotOf(was) : to;
  const t = ease(Math.min(1, into / SLIDE));
  const x = from.x + (to.x - from.x) * t;

  const boxHeight = to.height * height;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <DoodleInk>
        <div
          style={{
            position: 'absolute',
            top: to.top * height,
            height: boxHeight,
            // The drawing is half as wide as it is tall.
            width: boxHeight * 0.5,
            left: x * width - boxHeight * 0.25,
            opacity,
          }}
        >
          <Engineer
            theme={theme}
            beats={plan.beats}
            mimes={motion > 0 ? plan.mimes : []}
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      </DoodleInk>
    </AbsoluteFill>
  );
};
