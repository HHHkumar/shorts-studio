import React from 'react';
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Theme } from '../lib/theme';
import { DoodleZoneContext } from './doodle-zone';

// ---------------------------------------------------------------------------
// One doodle scene: the mascot's drawing beside the scene's own words.
//
// Every other look draws its picture BEHIND the words - dimmed, blurred and
// covered by a scrim so the text on top stays readable. On a doodle that is
// exactly wrong: the scrim turns white paper grey and the caption lands on
// the engineer's face. So here the frame is split. The words get a band of
// their own and the drawing gets the rest, and neither is ever on the other.
//
//   portrait   words across the top, drawing below
//   landscape  words down the left, drawing on the right
//
// The drawing is on white paper and the video is a paper page, so the picture
// is BLENDED into the page rather than pasted on: multiplied, which turns its
// white into whatever is under it - the page colour, the notebook dots - and
// leaves the ink. There is no rectangle; the engineer is drawn on the page.
// On the chalkboard version it is inverted to chalk lines and screened, with
// the hue turned back so red still reads as red.
//
// That is why this is two components rather than one. A blend mode only mixes
// with what is behind it INSIDE its compositing group, and the scene
// transition's transform makes a group of everything it wraps - so a drawing
// inside it blended with nothing and showed as a white box. DoodlePicture is
// therefore rendered outside the transition, straight onto the page, and does
// its own fade; DoodleText is what goes inside the transition.
// ---------------------------------------------------------------------------

type Box = { top: string; bottom: string; left: string; right: string };

// The two bands never overlap - the picture starts below where the text band
// ends, so a square drawing's head can never sit under the last line of words.
const PORTRAIT = {
  text: { top: '0%', bottom: '54%', left: '0%', right: '0%' },
  picture: { top: '47%', bottom: '3%', left: '4%', right: '4%' },
};
const LANDSCAPE = {
  text: { top: '0%', bottom: '0%', left: '0%', right: '44%' },
  picture: { top: '7%', bottom: '7%', left: '57%', right: '3%' },
};

/**
 * A drawing that stands beside the animated engineer (EngineerLayer.tsx): the
 * rest of the picture half, next to where he stands, and sat on the same
 * ground line as his feet. Square, like the drawing: the soft edge is centred
 * on the box, and in a tall box it faded out the ground the things stand on.
 */
const BESIDE: Record<'portrait' | 'landscape', Box> = {
  // 51% of 1080 wide is 551px; 551px tall above a 6.5% floor.
  portrait: { top: '64.8%', bottom: '6.5%', left: '46%', right: '3%' },
  // 22% of 1920 wide is 422px; 422px tall above a 9% floor.
  landscape: { top: '52%', bottom: '9%', left: '76%', right: '2%' },
};

const place = (box: Box): React.CSSProperties => ({ position: 'absolute', ...box });

/** Solid in the middle, clear at the edges, in case the image's paper was not quite white. */
export const FADE_EDGES = 'radial-gradient(ellipse 62% 62% at 50% 50%, #000 70%, transparent 100%)';

/**
 * How a doodle drawing is laid onto the page so its paper vanishes. Shared by
 * the video, the thumbnail and the carousel, so the three never disagree.
 *
 * The paper levels (#doodle-paper, in DoodleInk.tsx) are what make the paper
 * disappear: every paper tone becomes pure white - pure black once inverted -
 * the one value the blend treats as "nothing here", while the ink stays solid.
 * A contrast push used to do this and cleared only near-white paper; the
 * darker, photographed-looking paper at the foot of a drawing survived it and
 * showed in the finished video as a smudge under the engineer's feet.
 *
 * Whatever carries this must NOT sit inside anything with a transform,
 * opacity or filter - see the note at the top of this file.
 */
export function doodleBlend(theme: Theme): React.CSSProperties {
  // #doodle-paper is defined by DoodleFilters, which every Doodle composition
  // mounts: it turns any paper tone to pure white first, so the blend has
  // nothing left to show.
  return theme.mode === 'dark'
    ? { mixBlendMode: 'screen', filter: 'url(#doodle-paper) invert(1) hue-rotate(180deg)' }
    : { mixBlendMode: 'multiply', filter: 'url(#doodle-paper)' };
}

/** Frames to fade over - the same third of a second the scene transition uses. */
const FADE = 10;

/**
 * The drawing, on the page. Must NOT be placed inside anything with a
 * transform, opacity or filter, or the blend has nothing to blend with.
 *
 * `hold` is the scene's own length: the moment the next scene starts, and
 * therefore when this one starts to leave.
 */
export const DoodlePicture: React.FC<{
  theme: Theme;
  src: string;
  hold: number;
  /** Beside the animated engineer, rather than filling the picture half. */
  beside?: boolean;
}> = ({ theme, src, hold, beside = false }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const landscape = width > height;
  const zones = landscape ? LANDSCAPE : PORTRAIT;
  const box = beside ? BESIDE[landscape ? 'landscape' : 'portrait'] : zones.picture;

  // A little pop on the way in, then the faintest breathing - a still drawing
  // held for fifteen seconds reads as a frozen frame. A pure function of the
  // frame, so every render of a frame is identical.
  const enter = spring({ frame: frame - 3, fps, config: { damping: 11, stiffness: 120, mass: 0.7 } });
  const scale = 0.9 + 0.1 * enter + Math.sin(frame / 22) * 0.006;
  const tilt = (1 - enter) * -3 + Math.sin(frame / 31) * 0.35;
  const opacity = interpolate(frame, [0, FADE, hold, hold + FADE], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const ink = doodleBlend(theme);

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={place(box)}>
        <Img
          src={resolve(src)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            // Beside him, the things stand on his ground line, not mid-air.
            objectPosition: beside ? '50% 100%' : '50% 50%',
            // Everything that moves or fades is on the image itself, never on
            // a parent - see the note at the top about blend groups.
            opacity,
            transform: 'scale(' + scale + ') rotate(' + tilt + 'deg)',
            transformOrigin: '50% 85%',
            WebkitMaskImage: FADE_EDGES,
            maskImage: FADE_EDGES,
            ...ink,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

/** The scene's own words, held to their band so they never cross the drawing. */
export const DoodleText: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { width, height } = useVideoConfig();
  const landscape = width > height;
  const zones = landscape ? LANDSCAPE : PORTRAIT;
  return (
    <div style={place(zones.text)}>
      <DoodleZoneContext.Provider value={landscape ? 'text-left' : 'text-top'}>
        {children}
      </DoodleZoneContext.Provider>
    </div>
  );
};

function resolve(src: string): string {
  if (/^https?:\/\//i.test(src)) return src;
  return staticFile(src.replace(/^\/+/, ''));
}
