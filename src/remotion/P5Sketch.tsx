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
  /**
   * Which sketch this is. Changing it builds a fresh canvas rather than
   * swapping the draw function underneath the running one - see below.
   */
  id?: string;
}> = ({ draw, width, height, style, id }) => {
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
        // p5 keeps fill, stroke and weight between draws. A sketch that sets
        // noStroke() and one that never sets a fill would otherwise inherit
        // each other's state whenever they share an instance, and the second
        // would draw with settings it never asked for.
        p.noStroke();
        p.noFill();
        p.strokeWeight(1);
        p.strokeCap(p.ROUND);
        p.rectMode(p.CORNER);
        p.ellipseMode(p.CENTER);
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
      // p5.remove() does not reliably take its canvas with it, and the leftover
      // sat FIRST in the container - so after switching sketch the stale canvas
      // was the one on screen and the new one was laid out below it, off the
      // edge. That is what made a changed backdrop look like no change at all.
      // React never renders children here, so clearing the node is safe.
      container.current?.replaceChildren();
    };
    // Rebuilt when the canvas size changes, and when the sketch itself does.
    // Keeping one instance and swapping only the draw function left whatever
    // the previous sketch had put on the canvas to show through a switch.
  }, [width, height, id]);

  // Synchronous on purpose: the renderer may screenshot immediately after the
  // commit, so redrawing in a passive effect can capture the previous frame.
  useLayoutEffect(() => {
    instance.current?.redraw();
  }, [frame, draw]);

  return <div ref={container} style={{ width, height, ...style }} />;
};
