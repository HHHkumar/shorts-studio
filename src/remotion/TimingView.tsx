import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import wavedrom from 'wavedrom';
import darkSkin from 'wavedrom/skins/dark.js';
import type { Theme } from '../lib/theme';
import { toWaveJson, type Timing } from '../lib/timing';

// ---------------------------------------------------------------------------
// A simulated timing diagram, drawn by WaveDrom.
//
// The lanes were worked out by src/lib/timing.ts; WaveDrom draws them the way
// digital designers draw them - a clock with its edges marked, each signal a
// clean square wave - and the scene reveals them left to right, a cycle at a
// time, as the narration walks through the edges.
//
// WaveDrom's own type is set in the video's font, and its lines in the look's
// ink, so it sits in the frame like every other diagram.
// ---------------------------------------------------------------------------

const SKINS = { ...(wavedrom.waveSkin as Record<string, unknown>), ...(darkSkin as Record<string, unknown>) };

/** A stable small number for WaveDrom's element ids, so two diagrams on screen never share one. */
const idFor = (text: string) => {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) % 100000;
  return h;
};

export const TimingView: React.FC<{ theme: Theme; timing: Timing }> = ({ theme, timing }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const dark = theme.mode === 'dark';

  const svg = React.useMemo(() => {
    const source = toWaveJson(timing);
    const id = idFor(JSON.stringify(source));
    const tree = wavedrom.renderAny(id, { ...source, config: { ...(source.config as object), skin: dark ? 'dark' : 'default' } }, SKINS);
    // Sized by its box, not by WaveDrom's pixel width: the diagram fills the
    // scene. And on the video's own page: WaveDrom paints a white sheet behind
    // every diagram, whatever the skin, which on a dark look hid the waves.
    return String(wavedrom.onml.stringify(tree))
      .replace(/\swidth="[\d.]+"/, ' width="100%"')
      .replace(/\sheight="[\d.]+"/, '')
      .replace(/<rect width="[\d.]+" height="[\d.]+" style="stroke:none;fill:white"\s*\/?>(<\/rect>)?/, '');
  }, [timing, dark]);

  // A cycle at a time: everything is on screen by two thirds of the scene.
  const reveal = interpolate(frame, [4, Math.max(8, durationInFrames * 0.66)], [0.06, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <div
      className="timing-view"
      style={{ width: '100%', display: 'flex', justifyContent: 'center', clipPath: 'inset(0 ' + (1 - reveal) * 100 + '% 0 0)' }}
    >
      {/* The type in the video's own font and colour; the lines keep the skin's, light or dark. */}
      <style>{`.timing-view text { font-family: ${theme.fontBody}; fill: ${theme.text}; }`}</style>
      <div style={{ width: '94%' }} dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  );
};
