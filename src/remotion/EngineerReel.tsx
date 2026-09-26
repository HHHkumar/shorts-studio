import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { DEFAULT_DESIGN, getTheme } from '../lib/theme';
import { REEL, reelBeats, reelStarts, segmentWords } from '../lib/engineer-reel';
import { Backdrop } from './ui';
import { HandFonts } from './fonts';
import { DoodleFilters, DoodleInk } from './DoodleInk';
import { ReadAlong } from './ReadAlong';
import { Engineer } from './Engineer';

// ---------------------------------------------------------------------------
// A test reel for the animated engineer: every pose in turn, then every mime,
// each with a line to say, so the blinking, miming and changes of pose can be
// judged before he goes anywhere near a real video.
//
// Rendered by tools/engineer-preview.mjs. Word timings are even, standing in
// for the voice.
// ---------------------------------------------------------------------------

export const ENGINEER_REEL_ID = 'EngineerReel';
export { reelSeconds } from '../lib/engineer-reel';

export const EngineerReel: React.FC<{ mode: 'light' | 'dark' }> = ({ mode }) => {
  const theme = getTheme({ ...DEFAULT_DESIGN, layout: 'doodle', mode });
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const landscape = width > height;
  const beats = React.useMemo(() => reelBeats(), []);
  const perSegment = React.useMemo(() => REEL.map((_, i) => segmentWords(i)), []);
  const allWords = React.useMemo(() => perSegment.flat(), [perSegment]);

  // He is given only the current line's words, as he would be in a real
  // scene: the mime pacing allows a few per scene, not one per line of a reel.
  const time = frame / fps;
  const starts = reelStarts();
  let current = 0;
  starts.forEach((s, i) => { if (time >= s) current = i; });

  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg }}>
      <HandFonts />
      <DoodleFilters boil />
      <Backdrop theme={theme} />
      <DoodleInk>
        <AbsoluteFill
          style={{
            display: 'flex',
            flexDirection: landscape ? 'row' : 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 60,
            gap: 40,
          }}
        >
          <div style={{ width: landscape ? '50%' : '100%', minHeight: 260, display: 'flex', alignItems: 'center' }}>
            <ReadAlong theme={theme} words={allWords} fallbackText="" maxSize={88} minSize={64} />
          </div>
          <Engineer theme={theme} beats={beats} words={perSegment[current]} style={{ height: landscape ? '86%' : '62%' }} />
        </AbsoluteFill>
      </DoodleInk>
    </AbsoluteFill>
  );
};
