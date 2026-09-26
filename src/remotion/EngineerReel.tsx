import React from 'react';
import { AbsoluteFill, useVideoConfig } from 'remotion';
import { DEFAULT_DESIGN, getTheme } from '../lib/theme';
import type { WordTiming } from '../lib/types';
import { POSE_NAMES, type Beat, type PoseName } from '../lib/engineer-rig';
import { Backdrop } from './ui';
import { HandFonts } from './fonts';
import { DoodleFilters, DoodleInk } from './DoodleInk';
import { ReadAlong } from './ReadAlong';
import { Engineer } from './Engineer';

// ---------------------------------------------------------------------------
// A test reel for the animated engineer: every pose in turn, each with a line
// to say, so the talking, blinking, reactions and changes of pose can be
// judged before he goes anywhere near a real video.
//
// Rendered by tools/engineer-preview.mjs. Word timings are even, standing in
// for the voice.
// ---------------------------------------------------------------------------

export const ENGINEER_REEL_ID = 'EngineerReel';

/** Seconds each pose is held. */
export const REEL_SECONDS = 1.9;

const LINES: Record<PoseName, string> = {
  stand: 'Hi, I am your engineer.',
  wave: 'Hello, and welcome back!',
  point: 'Look at this circuit here.',
  idea: 'Wait, I have an idea!',
  think: 'Hmm, why is it turning?',
  shock: 'Whoa, sparks everywhere!',
  cheer: 'Yes! That is the answer!',
  teach: 'Current flows from here.',
  worried: 'It heats up far too fast.',
  shrug: 'Nobody really knows why.',
};

export const REEL_POSES: PoseName[] = POSE_NAMES;

export function reelWords(): WordTiming[] {
  const words: WordTiming[] = [];
  REEL_POSES.forEach((name, i) => {
    const list = LINES[name].split(/\s+/);
    const start = i * REEL_SECONDS + 0.35;
    const per = (REEL_SECONDS - 0.55) / list.length;
    list.forEach((word, k) => words.push({ word, start: start + k * per, end: start + (k + 0.85) * per }));
  });
  return words;
}

export const reelBeats = (): Beat[] => REEL_POSES.map((pose, i) => ({ at: i * REEL_SECONDS, pose }));

export const EngineerReel: React.FC<{ mode: 'light' | 'dark' }> = ({ mode }) => {
  const theme = getTheme({ ...DEFAULT_DESIGN, layout: 'doodle', mode });
  const { width, height } = useVideoConfig();
  const words = React.useMemo(() => reelWords(), []);
  const beats = React.useMemo(() => reelBeats(), []);
  const landscape = width > height;

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
            <ReadAlong theme={theme} words={words} fallbackText="" maxSize={88} minSize={64} />
          </div>
          <Engineer theme={theme} beats={beats} words={words} style={{ height: landscape ? '86%' : '62%' }} />
        </AbsoluteFill>
      </DoodleInk>
    </AbsoluteFill>
  );
};
