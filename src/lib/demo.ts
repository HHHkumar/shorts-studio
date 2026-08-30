import { DEFAULT_DESIGN } from './theme';
import { buildScenes } from './timeline';
import type { QuizContent, VideoProps } from './types';
import { FPS } from './types';

/**
 * A hard-coded example so the preview (and `npm run studio`) always has
 * something to show before you generate anything.
 */
export const DEMO_CONTENT: QuizContent = {
  subject: 'Physics',
  topic: 'Gravity',
  difficulty: 'Medium',
  hook: 'Most people get this wrong.',
  question: 'You drop a hammer and a feather on the Moon. Which lands first?',
  options: ['The hammer', 'The feather', 'They land together', 'Neither one falls'],
  correctIndex: 2,
  answerLine: 'They land at exactly the same time.',
  explanation: [
    'The Moon has almost no atmosphere, so there is no air resistance.',
    'Gravity gives every object the same acceleration, about 1.62 m/s².',
    'Same acceleration plus same drop height means the same fall time.',
  ],
  funFact: 'Apollo 15 astronaut David Scott actually filmed this on the Moon in 1971.',
  outro: 'Follow for one more every day.',
  hashtags: ['physics', 'space', 'science', 'apollo15'],
  motifSymbols: ['🌙', '🔨', '🪶', 'g', '⬇'],
  script: [
    { kind: 'hook', narration: 'Most people get this one wrong.', onScreen: 'Most people get this wrong.' },
    {
      kind: 'question',
      narration: 'On the Moon, you drop a hammer and a feather at the same moment. Which one hits the ground first?',
      onScreen: 'Hammer or feather — which lands first on the Moon?',
    },
    { kind: 'options', narration: 'Here are your choices.', onScreen: 'Hammer or feather?' },
    { kind: 'countdown', narration: '', onScreen: 'Hammer or feather?' },
    { kind: 'answer', narration: 'They land together.', onScreen: 'They land together.' },
    {
      kind: 'explain',
      narration: 'The Moon has essentially no atmosphere, so there is no air to slow the feather down.',
      onScreen: 'No air. No air resistance.',
      bullets: ['Earth: air slows the feather', 'Moon: nothing to slow it'],
      visual: {
        kind: 'compare',
        caption: 'Same drop, different air',
        items: [
          { label: 'On Earth', symbol: '🌍' },
          { label: 'On the Moon', symbol: '🌙' },
        ],
      },
    },
    {
      kind: 'explain',
      narration: 'Gravity accelerates every object at the same rate, no matter how heavy it is.',
      onScreen: 'Gravity pulls everything equally.',
      bullets: ['Moon gravity ≈ 1.62 m/s²', 'Mass cancels out'],
      visual: {
        kind: 'bars',
        caption: 'Surface gravity, m/s²',
        items: [
          { label: 'Earth', value: 9.81 },
          { label: 'Moon', value: 1.62 },
        ],
      },
    },
    {
      kind: 'outro',
      narration: 'Apollo fifteen actually filmed this in nineteen seventy one. Follow for one more every day.',
      onScreen: 'Follow for one every day.',
    },
  ],
};

export function makeDemoProps(): VideoProps {
  const { scenes, totalDurationInFrames } = buildScenes(DEMO_CONTENT.script, {}, DEFAULT_DESIGN, FPS);
  return {
    content: DEMO_CONTENT,
    scenes,
    design: DEFAULT_DESIGN,
    fps: FPS,
    totalDurationInFrames,
  };
}
