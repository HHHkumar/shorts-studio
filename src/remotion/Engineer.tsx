import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import type { Theme } from '../lib/theme';
import type { WordTiming } from '../lib/types';
import { figureAt, rotate, SHEET, type Beat, type Figure, type Pt } from '../lib/engineer-rig';

// ---------------------------------------------------------------------------
// The engineer, drawn from the rig in engineer-rig.ts.
//
// Marker lines in the page's own ink, so light mode is pen on paper and dark
// mode is chalk, like the drawings. The one red is the bolt on his hat and
// the sparkle of a win - red means live, as everywhere in this look.
//
// Filled with the page colour where he is solid (head, hat, hands), so a limb
// passing behind him is hidden rather than drawn through his face.
// ---------------------------------------------------------------------------

/** The part of the sheet he occupies, with room over his hat for an idea. */
const VIEW = { x: 130, y: 100, w: 520, h: 1040 };

const INK = 8;

const P = (p: Pt) => p.x.toFixed(1) + ' ' + p.y.toFixed(1);

/** A limb: root, joint, end, as one bent marker line. */
const limb = (a: Pt, b: Pt, c: Pt) => 'M ' + P(a) + ' L ' + P(b) + ' L ' + P(c);

const Hand: React.FC<{ at: Pt; from: Pt; finger: boolean; ink: string; paper: string }> = ({ at, from, finger, ink, paper }) => {
  // The mitten faces along the forearm, thumb up.
  const deg = (Math.atan2(at.y - from.y, at.x - from.x) * 180) / Math.PI;
  return (
    <g transform={'translate(' + P(at) + ') rotate(' + deg.toFixed(1) + ')'}>
      {finger ? <path d="M 26 -2 L 58 -4" stroke={ink} strokeWidth={INK} strokeLinecap="round" /> : null}
      {/* A mitten, as on the model sheet: the thumb, then the palm over it. */}
      <ellipse cx={10} cy={-15} rx={8} ry={11} transform="rotate(-30 10 -15)" fill={paper} stroke={ink} strokeWidth={INK * 0.75} />
      <ellipse cx={16} cy={2} rx={19} ry={16} fill={paper} stroke={ink} strokeWidth={INK * 0.75} />
    </g>
  );
};

const Face: React.FC<{ f: Figure; ink: string; paper: string }> = ({ f, ink, paper }) => {
  const lx = f.look.x * 12;
  const ly = f.look.y * 9;
  const eyes = [pt0(318, 462), pt0(440, 462)];

  const eye = (c: Pt, i: number) => {
    if (f.eyes === 'happy') {
      return <path key={i} d={'M ' + (c.x - 18) + ' ' + (c.y + 6) + ' Q ' + c.x + ' ' + (c.y - 18) + ' ' + (c.x + 18) + ' ' + (c.y + 6)} fill="none" stroke={ink} strokeWidth={INK} strokeLinecap="round" />;
    }
    const shut = f.eyes === 'closed' ? 1 : f.eyesShut;
    if (f.eyes === 'wide') {
      return (
        <g key={i}>
          <ellipse cx={c.x} cy={c.y - 4} rx={25} ry={Math.max(3, 27 * (1 - shut))} fill={paper} stroke={ink} strokeWidth={INK * 0.7} />
          {shut < 0.6 ? <circle cx={c.x + lx * 0.8} cy={c.y - 4 + ly * 0.8} r={10} fill={ink} /> : null}
        </g>
      );
    }
    return <ellipse key={i} cx={c.x + lx} cy={c.y + ly} rx={13} ry={Math.max(2.5, 14 * (1 - shut))} fill={ink} />;
  };

  const brows = () => {
    if (f.brows === 'none') return null;
    const worried = f.brows === 'worried';
    return eyes.map((c, i) => {
      const inner = i === 0 ? 1 : -1;
      // Worried: the inner ends lift. Up: both lift, surprised.
      // Low enough to clear the hat brim.
      const yIn = c.y - (worried ? 44 : 38);
      const yOut = c.y - (worried ? 30 : 38);
      return (
        <path
          key={'b' + i}
          d={'M ' + (c.x - 22 * inner) + ' ' + yOut + ' Q ' + c.x + ' ' + (Math.min(yIn, yOut) - 8) + ' ' + (c.x + 22 * inner) + ' ' + yIn}
          fill="none"
          stroke={ink}
          strokeWidth={INK * 0.8}
          strokeLinecap="round"
        />
      );
    });
  };

  const mouth = () => {
    // Talking opens whatever shape he holds into a flapping mouth; an 'o'
    // stays an 'o' and only stretches.
    if (f.mouth === 'o') {
      return <ellipse cx={382} cy={548} rx={16} ry={20 + f.talk * 8} fill={ink} />;
    }
    if (f.talk > 0.06 || f.mouth === 'grin') {
      const open = f.mouth === 'grin' ? Math.max(0.55, f.talk) : f.talk;
      return (
        <path
          d={'M 338 532 Q 384 ' + (536 - 4 * open).toFixed(1) + ' 430 530 Q 384 ' + (544 + 46 * open).toFixed(1) + ' 338 532 Z'}
          fill={ink}
          stroke={ink}
          strokeWidth={INK * 0.8}
          strokeLinejoin="round"
        />
      );
    }
    const d = {
      smile: 'M 338 536 Q 384 568 430 534',
      flat: 'M 350 548 L 416 545',
      frown: 'M 344 560 Q 384 532 424 558',
    }[f.mouth];
    return <path d={d} fill="none" stroke={ink} strokeWidth={INK} strokeLinecap="round" />;
  };

  return (
    <>
      {eyes.map(eye)}
      {brows()}
      {mouth()}
    </>
  );
};

const pt0 = (x: number, y: number): Pt => ({ x, y });

/** The doodled extras: ?, !, a sweat drop, a win sparkle, a light bulb. */
const PropMark: React.FC<{ prop: Figure['prop']; time: number; ink: string; paper: string; accent: string }> = ({
  prop, time, ink, paper, accent,
}) => {
  const bob = Math.sin(time * Math.PI * 2 * 0.9) * 8;
  const stroke = { fill: 'none', stroke: ink, strokeWidth: INK, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (prop) {
    case 'question':
      return (
        <g transform={'translate(0 ' + bob.toFixed(1) + ')'}>
          <path d="M 548 262 C 548 222, 612 220, 612 262 C 612 296, 580 294, 580 330" {...stroke} />
          <circle cx={580} cy={360} r={7} fill={ink} />
        </g>
      );
    case 'exclaim':
      return (
        <g transform={'translate(0 ' + (-Math.abs(bob)).toFixed(1) + ')'}>
          <path d="M 578 214 L 568 300" {...stroke} />
          <circle cx={566} cy={328} r={7} fill={ink} />
        </g>
      );
    case 'sweat': {
      const slide = ((time * 0.6) % 1) * 40;
      return (
        <path
          d={'M 536 ' + (400 + slide) + ' C 524 ' + (428 + slide) + ', 512 ' + (444 + slide) + ', 520 ' + (458 + slide)
            + ' A 18 18 0 0 0 552 ' + (456 + slide) + ' C 558 ' + (442 + slide) + ', 546 ' + (426 + slide) + ', 536 ' + (400 + slide)}
          fill={paper}
          stroke={ink}
          strokeWidth={INK * 0.7}
          strokeLinejoin="round"
          opacity={1 - slide / 60}
        />
      );
    }
    case 'sparkle': {
      const s = 1 + Math.sin(time * Math.PI * 2 * 1.5) * 0.18;
      const star = (x: number, y: number, r: number) => (
        <path
          key={x}
          transform={'translate(' + x + ' ' + y + ') scale(' + s.toFixed(3) + ')'}
          d={'M 0 ' + -r + ' Q ' + r * 0.15 + ' ' + -r * 0.15 + ' ' + r + ' 0 Q ' + r * 0.15 + ' ' + r * 0.15 + ' 0 ' + r
            + ' Q ' + -r * 0.15 + ' ' + r * 0.15 + ' ' + -r + ' 0 Q ' + -r * 0.15 + ' ' + -r * 0.15 + ' 0 ' + -r}
          fill="none"
          stroke={accent}
          strokeWidth={INK * 0.8}
          strokeLinejoin="round"
        />
      );
      return <>{[star(196, 330, 30), star(574, 300, 36), star(610, 420, 20)]}</>;
    }
    case 'idea':
      return (
        <g transform={'translate(0 ' + bob.toFixed(1) + ')'}>
          <path d="M 372 120 m -34 42 a 38 38 0 1 1 68 0 c -8 10, -12 16, -12 28 l -44 0 c 0 -12, -4 -18, -12 -28 Z" fill={paper} {...{ stroke: ink, strokeWidth: INK * 0.8, strokeLinejoin: 'round' as const }} />
          <path d="M 354 204 L 390 204 M 358 216 L 386 216" {...stroke} strokeWidth={INK * 0.7} />
          <path d="M 300 132 L 280 124 M 444 132 L 464 124 M 318 92 L 304 76 M 426 92 L 440 76 M 372 70 L 372 50" fill="none" stroke={accent} strokeWidth={INK * 0.8} strokeLinecap="round" />
        </g>
      );
    default:
      return null;
  }
};

/**
 * The engineer, at the current frame.
 *
 * `beats` choose his poses over the scene; `words` are the narration's word
 * timings, which make him talk and react. Sized by its box: he fills its
 * height, keeping his proportions.
 */
export const Engineer: React.FC<{
  theme: Theme;
  beats: Beat[];
  words?: WordTiming[];
  /** Seconds to subtract from the frame's time: the caption offset. */
  offset?: number;
  /** Mirror him, so he faces the other way. */
  flip?: boolean;
  style?: React.CSSProperties;
}> = ({ theme, beats, words = [], offset = 0, flip = false, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const time = frame / fps - offset;
  const f = figureAt(beats, words, time);

  const ink = theme.text;
  const paper = theme.bg;
  const line = { fill: 'none', stroke: ink, strokeWidth: INK, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

  // Everything above the hips moves as one: the bob, the shake, the lean.
  const body = 'translate(' + f.body.dx.toFixed(2) + ' ' + f.body.dy.toFixed(2) + ') rotate('
    + f.body.lean.toFixed(2) + ' ' + P(SHEET.hips) + ')';
  const head = 'rotate(' + f.headTilt.toFixed(2) + ' ' + P(SHEET.neck) + ')';
  // The prop follows the head, so a '?' stays by it when he tilts.
  const neck = rotate(SHEET.neck, SHEET.hips, f.body.lean);

  return (
    <svg
      viewBox={VIEW.x + ' ' + VIEW.y + ' ' + VIEW.w + ' ' + VIEW.h}
      style={{ overflow: 'visible', ...style }}
      aria-hidden="true"
    >
      <g transform={flip ? 'translate(' + (2 * VIEW.x + VIEW.w) + ' 0) scale(-1 1)' : undefined}>
        {/* Legs and shoes, behind the shirt. */}
        <path d={limb(f.legs.l.hip, f.legs.l.knee, f.legs.l.foot)} {...line} />
        <path d={limb(f.legs.r.hip, f.legs.r.knee, f.legs.r.foot)} {...line} />
        <ellipse cx={f.legs.l.foot.x - 22} cy={f.legs.l.foot.y + 4} rx={36} ry={12} fill={ink} />
        <ellipse cx={f.legs.r.foot.x + 22} cy={f.legs.r.foot.y + 4} rx={36} ry={12} fill={ink} />

        {/* Arms: drawn in page space (the rig already leaned them), under the shirt. */}
        <path d={limb(f.arms.l.shoulder, f.arms.l.elbow, f.arms.l.hand)} {...line} />
        <path d={limb(f.arms.r.shoulder, f.arms.r.elbow, f.arms.r.hand)} {...line} />

        <g transform={body}>
          {/* The black T-shirt, with its white collar notch. */}
          <path
            d="M 342 612 Q 300 616 280 632 L 256 688 L 300 702 L 304 830 L 464 822 L 452 700 L 496 684 L 470 628 Q 448 614 402 612 Z"
            fill={ink}
            stroke={ink}
            strokeWidth={INK * 0.8}
            strokeLinejoin="round"
          />
          <path d="M 352 612 Q 372 646 394 612 Z" fill={paper} />

          <g transform={head}>
            <circle cx={SHEET.head.x} cy={SHEET.head.y} r={SHEET.headR} fill={paper} stroke={ink} strokeWidth={INK} />
            <Face f={f} ink={ink} paper={paper} />
            {/* The hard hat, which hops off his head when something goes bang. */}
            <g transform={'translate(0 ' + (-f.hatLift).toFixed(1) + ') rotate(' + (-f.hatLift * 0.12).toFixed(2) + ' 372 390)'}>
              <path d="M 234 386 C 232 292, 292 238, 372 236 C 454 238, 512 292, 510 386 Z" fill={paper} stroke={ink} strokeWidth={INK} strokeLinejoin="round" />
              <path d="M 330 252 C 318 292, 318 340, 322 384 M 416 252 C 428 292, 428 340, 424 384" fill="none" stroke={ink} strokeWidth={INK * 0.6} strokeLinecap="round" />
              <path d="M 382 280 L 354 324 L 378 324 L 362 360 L 402 306 L 378 306 L 394 280 Z" fill={theme.accent} />
              <rect x={212} y={382} width={330} height={18} rx={9} fill={paper} stroke={ink} strokeWidth={INK} />
            </g>
          </g>
        </g>

        {/* Hands last, so one raised to his chin sits in front of his face. */}
        <Hand at={f.arms.l.hand} from={f.arms.l.elbow} finger={f.finger === 'l'} ink={ink} paper={paper} />
        <Hand at={f.arms.r.hand} from={f.arms.r.elbow} finger={f.finger === 'r'} ink={ink} paper={paper} />

        <g transform={'translate(' + (neck.x - SHEET.neck.x + f.body.dx).toFixed(1) + ' ' + (neck.y - SHEET.neck.y + f.body.dy).toFixed(1) + ')'}>
          <PropMark prop={f.prop} time={time} ink={ink} paper={paper} accent={theme.accent} />
        </g>
      </g>
    </svg>
  );
};
