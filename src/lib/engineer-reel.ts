import type { WordTiming } from './types';
import type { Beat, PoseName } from './engineer-rig';
import type { EffectKind } from './motion-lexicon';

// The script of the animated engineer's test reel (src/remotion/EngineerReel.tsx):
// every pose in turn, then every mime, each with a line. Its own module so the
// preview tool can find where each segment falls without loading React.

export interface Segment {
  pose: PoseName;
  line: string;
  seconds: number;
  /** For a mime segment, the action it shows. */
  mime?: EffectKind;
}

// The pose lines have no action words in them, so each pose is seen as posed;
// the mime lines have exactly one.
const POSE_LINES: [PoseName, string][] = [
  ['stand', 'Hi, I am your engineer.'],
  ['wave', 'Hello, and welcome back!'],
  ['point', 'Look at this one here.'],
  ['idea', 'Wait, I have an idea!'],
  ['think', 'Hmm, why would that be?'],
  ['shock', 'Whoa, look at that!'],
  ['cheer', 'Yes! That is the answer!'],
  ['teach', 'Let me show you how.'],
  ['worried', 'Oh no, this looks bad.'],
  ['shrug', 'Nobody really knows why.'],
];

const MIME_LINES: [EffectKind, string][] = [
  ['flow', 'Water flows down the pipe.'],
  ['rise', 'The temperature rises slowly.'],
  ['fall', 'Then the pressure falls.'],
  ['spin', 'The rotor spins round and round.'],
  ['heat', 'The coil heats up quickly.'],
  ['cool', 'Then the oil cools down.'],
  ['impact', 'Two balls collide head on.'],
  ['spark', 'Sparks fly from the contacts.'],
  ['burst', 'The steam bursts out.'],
  ['glow', 'The filament glows brightly.'],
  ['drip', 'Water drips from the tank.'],
  ['wobble', 'The contacts vibrate rapidly.'],
];

export const REEL: Segment[] = [
  ...POSE_LINES.map(([pose, line]) => ({ pose, line, seconds: 2.2 })),
  ...MIME_LINES.map(([mime, line]) => ({ pose: 'stand' as PoseName, line, seconds: 2.6, mime })),
];

export const reelStarts = (): number[] => {
  let at = 0;
  return REEL.map((s) => {
    const start = at;
    at += s.seconds;
    return start;
  });
};

export const reelSeconds = (): number => REEL.reduce((n, s) => n + s.seconds, 0);

export function segmentWords(i: number): WordTiming[] {
  const s = REEL[i];
  const list = s.line.split(/\s+/);
  const start = reelStarts()[i] + 0.3;
  const per = Math.min(0.32, (s.seconds - 0.8) / list.length);
  return list.map((word, k) => ({ word, start: start + k * per, end: start + (k + 0.85) * per }));
}

export const reelBeats = (): Beat[] => {
  const starts = reelStarts();
  return REEL.map((s, i) => ({ at: starts[i], pose: s.pose }));
};
