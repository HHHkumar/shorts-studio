// The starting search for a shot's stock photo or video.

import { spokenText } from './speech';
import type { Shot } from './types';

const STOP = new Set(['a', 'an', 'the', 'of', 'in', 'on', 'at', 'with', 'and', 'to', 'for', 'from', 'by', 'is', 'are', 'was', 'his', 'her', 'their', 'its', 'this', 'that', 'wide', 'shot', 'close', 'up', 'medium', 'view', 'scene', 'showing']);

/** A starting search when the writer gave none: the first few meaningful words of the picture description. */
export function defaultQuery(shot: Pick<Shot, 'stockQuery' | 'imagePrompt'>, narration = ''): string {
  if (shot.stockQuery && shot.stockQuery.trim()) return shot.stockQuery.trim();
  const words = (shot.imagePrompt || spokenText(narration)).replace(/[^\p{L}\p{N}\s'-]/gu, ' ').split(/\s+/).filter((w) => w && !STOP.has(w.toLowerCase()));
  return words.slice(0, 5).join(' ');
}
