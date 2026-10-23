// ---------------------------------------------------------------------------
// Camera moves over a still picture.
//
// Returned as numbers, not a CSS string, for one reason: parallax. A cut-out
// character in front of the picture takes the same move exaggerated, so it
// slides a little further than the background behind it - which is all the
// eye needs to read depth.
//
// Every move is a pure function of the frame, like everything in a render.
// ---------------------------------------------------------------------------

import type { Motion, Point } from '../lib/types';
import { hash } from './noise';

export interface Camera {
  scale: number;
  /** Translation in % of the frame. */
  tx: number;
  ty: number;
  /** Degrees. */
  rot: number;
  /** Pixels of blur (rack focus, whip). */
  blur: number;
}

const ease = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * Math.max(0, Math.min(1, t)));
const easeOut = (t: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);

/**
 * Where the camera is `frame` frames into a shot of `span` frames.
 * `amount` is the Look step's "camera movement" (0..1). `focus` is where it heads.
 */
export function cameraAt(motion: Exclude<Motion, 'auto'>, frame: number, span: number, fps: number, amount: number, focus: Point): Camera {
  const p = ease(frame / Math.max(1, span - 1));
  const z = 0.16 * amount;
  const pan = 5 * amount;
  // Zooms push towards the focus point: the frame drifts so that point comes to the centre.
  const toward = (k: number) => ({ tx: (0.5 - focus.x) * 100 * k * 0.35, ty: (0.5 - focus.y) * 100 * k * 0.35 });
  const still: Camera = { scale: 1.02, tx: 0, ty: 0, rot: 0, blur: 0 };

  switch (motion) {
    case 'zoom-in': {
      const t = toward(z * p);
      return { ...still, scale: 1.04 + z * p, ...t };
    }
    case 'zoom-out': {
      const t = toward(z * (1 - p));
      return { ...still, scale: 1.04 + z * (1 - p), ...t };
    }
    case 'pan-left':
      return { ...still, scale: 1.06 + z * 0.6, tx: pan * (0.5 - p) };
    case 'pan-right':
      return { ...still, scale: 1.06 + z * 0.6, tx: pan * (p - 0.5) };
    case 'pan-up':
      return { ...still, scale: 1.06 + z * 0.6, ty: pan * 0.8 * (p - 0.5) };
    case 'push-rotate': {
      const t = toward(z * p);
      return { ...still, scale: 1.06 + z * 1.1 * p, rot: (p - 0.5) * 2.4 * amount, ...t };
    }
    case 'drift': {
      // Handheld: two slow wandering sines, never quite repeating.
      const t = frame / fps;
      return {
        ...still,
        scale: 1.07,
        tx: (Math.sin(t * 0.63) * 0.9 + Math.sin(t * 1.37 + 1) * 0.4) * amount,
        ty: (Math.cos(t * 0.51) * 0.6 + Math.sin(t * 1.11 + 2) * 0.3) * amount,
        rot: Math.sin(t * 0.43) * 0.35 * amount,
      };
    }
    case 'rack-focus': {
      // Soft to sharp over the first second and a half, with a gentle push.
      const sharp = easeOut(frame / (fps * 1.5));
      const t = toward(z * 0.6 * p);
      return { ...still, scale: 1.04 + z * 0.6 * p, blur: (1 - sharp) * 14, ...t };
    }
    case 'shake': {
      // A hit, then settling: jitter that decays over about a second, on a slow push.
      const decay = Math.exp(-frame / (fps * 0.35));
      const j = (k: number) => (hash(frame * 7 + k) - 0.5) * 2;
      return {
        ...still,
        scale: 1.08 + z * 0.5 * p,
        tx: j(1) * 2.4 * decay,
        ty: j(2) * 1.8 * decay,
        rot: j(3) * 1.2 * decay,
      };
    }
    case 'whip': {
      // Arrives fast from the side with motion blur, then drifts in slowly.
      const land = easeOut(frame / (fps * 0.45));
      const t = toward(z * 0.5 * p);
      return { ...still, scale: 1.05 + z * 0.5 * p, tx: (1 - land) * 60 + t.tx, ty: t.ty, blur: (1 - land) * 28 };
    }
    default:
      return still;
  }
}

/** The same move, stronger: for layers in front of the picture. */
export function parallax(c: Camera, depth: number): Camera {
  return { scale: 1 + (c.scale - 1) * depth, tx: c.tx * depth, ty: c.ty * depth, rot: c.rot, blur: c.blur };
}

export const cameraTransform = (c: Camera): string =>
  `translate(${c.tx}%, ${c.ty}%) scale(${c.scale}) rotate(${c.rot}deg)`;
