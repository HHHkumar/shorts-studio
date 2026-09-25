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

const place = (box: Box): React.CSSProperties => ({ position: 'absolute', ...box });

/** Solid in the middle, clear at the edges, in case the image's paper was not quite white. */
const FADE_EDGES = 'radial-gradient(ellipse 62% 62% at 50% 50%, #000 70%, transparent 100%)';

/** Frames to fade over - the same third of a second the scene transition uses. */
const FADE = 10;

/**
 * The drawing, on the page. Must NOT be placed inside anything with a
 * transform, opacity or filter, or the blend has nothing to blend with.
 *
 * `hold` is the scene's own length: the moment the next scene starts, and
 * therefore when this one starts to leave.
 */
export const DoodlePicture: React.FC<{ theme: Theme; src: string; hold: number }> = ({ theme, src, hold }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const zones = width > height ? LANDSCAPE : PORTRAIT;

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

  // The contrast is what makes the paper disappear. The drawings come back on
  // paper that is photographed-grey rather than white, and after inversion
  // that grey lifted the chalkboard into a visible box. Pushing contrast clips
  // near-white paper to pure white (pure black once inverted) - the one value
  // the blend treats as "nothing here" - while the ink stays solid.
  const chalk = theme.mode === 'dark';
  const ink: React.CSSProperties = chalk
    ? { mixBlendMode: 'screen', filter: 'invert(1) hue-rotate(180deg) contrast(1.45)' }
    : { mixBlendMode: 'multiply', filter: 'brightness(1.12) contrast(1.2)' };

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={place(zones.picture)}>
        <Img
          src={resolve(src)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
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
