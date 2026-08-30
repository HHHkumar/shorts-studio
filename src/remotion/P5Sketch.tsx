import p5 from 'p5';
import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { continueRender, delayRender, useCurrentFrame, useVideoConfig } from 'remotion';

/**
 * Runs a p5 sketch as a pure function of the current frame.
 *
 * p5's normal draw loop is driven by requestAnimationFrame, which Remotion's
 * renderer never runs - it seeks to a frame and screenshots it. So the loop is
 * switched off with noLoop() and we call redraw() ourselves, synchronously,
 * every time the frame changes.
 *
 * The contract for a sketch: given the same frame number it must draw the same
 * pixels. No accumulating state between draws, no Date.now(), and any
 * randomness seeded from the frame or a constant.
 */
export interface SketchArgs {
  p: p5;
  /** Frames elapsed since this sketch's scene began. */
  frame: number;
  /** Seconds elapsed, i.e. frame / fps. */
  time: number;
  /** 0 to 1 across the scene, the most useful driver for a one-shot animation. */
  progress: number;
  width: number;
  height: number;
}

export type SketchFn = (args: SketchArgs) => void;

export const P5Sketch: React.FC<{
  draw: SketchFn;
  width: number;
  height: number;
  style?: React.CSSProperties;
}> = ({ draw, width, height, style }) => {
  const container = useRef<HTMLDivElement>(null);
  const instance = useRef<p5 | null>(null);
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // The draw callback reads these through a ref, so the sketch instance never
  // has to be torn down and rebuilt when the frame advances.
  const state = useRef({ frame, fps, durationInFrames, draw });
  state.current = { frame, fps, durationInFrames, draw };

  useEffect(() => {
    const handle = delayRender('Creating p5 sketch');

    const sketch = (p: p5) => {
      p.setup = () => {
        p.createCanvas(width, height);
        p.pixelDensity(1);
        // Determinism: without a fixed seed, p.random() would differ each pass.
        p.randomSeed(1);
        p.noiseSeed(1);
        p.noLoop();
      };

      p.draw = () => {
        const s = state.current;
        p.randomSeed(1);
        p.noiseSeed(1);
        p.clear();
        s.draw({
          p,
          frame: s.frame,
          time: s.frame / s.fps,
          progress: s.durationInFrames > 1 ? s.frame / (s.durationInFrames - 1) : 0,
          width,
          height,
        });
      };
    };

    instance.current = new p5(sketch, container.current as HTMLElement);
    continueRender(handle);

    return () => {
      instance.current?.remove();
      instance.current = null;
    };
    // Rebuilt only if the canvas size changes.
  }, [width, height]);

  // Synchronous on purpose: the renderer may screenshot immediately after the
  // commit, so redrawing in a passive effect can capture the previous frame.
  useLayoutEffect(() => {
    instance.current?.redraw();
  }, [frame, draw]);

  return <div ref={container} style={{ width, height, ...style }} />;
};
