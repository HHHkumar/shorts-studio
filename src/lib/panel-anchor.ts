import { alignLabels, revealedCount } from './options-timing';
import type { ScenePanel, SceneKind, WordTiming } from './types';

// ---------------------------------------------------------------------------
// Where on the frame the narration is pointing, right now.
//
// The effects used to land dead centre whatever the scene was about, so a spin
// fired on the word "turbine" appeared in the middle of the frame rather than
// on the turbine. It read as decoration bolted on top rather than as part of
// the explanation, which is most of the difference between convincing and not.
//
// Worked out rather than measured. Every panel lays itself out from the same
// two facts - how many items there are and which one the voice has reached -
// so the same arithmetic run here gives the same answer without a render pass,
// a ref, or a frame of lag. Duplicating a little layout maths is the price;
// measuring the DOM mid-render would cost correctness, which is dearer.
//
// It is an approximation on purpose. Getting the active item's COLUMN right is
// what makes an effect look aimed; getting its exact pixel box right adds
// nothing a viewer can see.
// ---------------------------------------------------------------------------

/** A point on the frame, 0-1 from the top left. */
export interface Anchor {
  x: number;
  y: number;
}

/** Dead centre, for when a panel gives us nothing to aim at. */
export const CENTRE: Anchor = { x: 0.5, y: 0.5 };

/**
 * The things a panel reveals, in the order the narration covers them.
 *
 * Must match what the panel itself reveals, or the active index computed here
 * points at the wrong thing. That is why it lives beside the anchor rather
 * than being written out again in each caller.
 */
export function revealOrder(panel: ScenePanel | undefined): string[] {
  if (!panel) return [];
  const out: string[] = [];
  if (panel.leftLabel) out.push(panel.leftLabel);
  if (panel.rightLabel) out.push(panel.rightLabel);
  (panel.nodes || []).forEach((n) => out.push(n.label));
  (panel.steps || []).forEach((s) => out.push(s.label));
  return out.filter(Boolean);
}

/** Which item the voice has reached, or -1 when there is nothing to reach. */
export function activeIndex(
  panel: ScenePanel | undefined,
  words: WordTiming[],
  time: number,
  sceneSeconds: number,
): number {
  const labels = revealOrder(panel);
  if (!labels.length) return -1;
  const starts = alignLabels(words, labels, sceneSeconds);
  return revealedCount(starts, time) - 1;
}

/**
 * Where the item at `index` sits, in panel space (0-1 across the panel).
 *
 * One branch per layout, each mirroring how that panel arranges itself. A kind
 * with no branch falls through to the centre, which is the honest answer for a
 * title card - there is nothing on it to point at.
 */
function inPanelSpace(
  kind: SceneKind,
  panel: ScenePanel,
  index: number,
  landscape: boolean,
): Anchor {
  const steps = panel.steps || [];
  const nodes = panel.nodes || [];

  if (kind === 'diagram' && nodes.length) {
    // The boxes are on a col/row grid, defaulting to a wrapping flow of three.
    const perRow = Math.min(3, nodes.length);
    const placed = nodes.map((n, i) => ({
      col: Number.isFinite(n.col as number) ? (n.col as number) : i % perRow,
      row: Number.isFinite(n.row as number) ? (n.row as number) : Math.floor(i / perRow),
    }));
    const cols = Math.max(...placed.map((n) => n.col)) + 1;
    const rows = Math.max(...placed.map((n) => n.row)) + 1;
    const at = placed[Math.min(index, placed.length - 1)];
    return { x: (at.col + 0.5) / cols, y: (at.row + 0.5) / rows };
  }

  if (kind === 'process' && steps.length) {
    // Across the frame when there is room, stacked otherwise - the same test
    // ProcessPanel makes.
    const row = landscape && steps.length <= 4;
    const at = Math.min(index, steps.length - 1);
    return row
      ? { x: (at + 0.5) / steps.length, y: 0.5 }
      : { x: 0.5, y: (at + 0.5) / steps.length };
  }

  if ((kind === 'grid' || kind === 'timeline' || kind === 'recap') && steps.length) {
    if (kind === 'grid') {
      const perRow = Math.min(3, steps.length);
      const rows = Math.ceil(steps.length / perRow);
      const at = Math.min(index, steps.length - 1);
      return { x: ((at % perRow) + 0.5) / perRow, y: (Math.floor(at / perRow) + 0.5) / rows };
    }
    // Timeline and recap both run down the frame.
    const at = Math.min(index, steps.length - 1);
    return { x: 0.5, y: (at + 0.5) / steps.length };
  }

  if (kind === 'metaphor' || kind === 'versus') {
    // Two sides. Index 0 is the left label, 1 the right; anything after that is
    // a point under one of them, which is close enough to the same column.
    return { x: index <= 0 ? 0.28 : 0.72, y: 0.5 };
  }

  if (kind === 'motion') {
    const actors = panel.actors || [];
    // Motion actors carry their own coordinates, which is exactly what this is.
    const accent = actors.find((a) => a.accent) || actors[0];
    return accent ? { x: accent.x, y: accent.y } : CENTRE;
  }

  return CENTRE;
}

/**
 * The anchor in FRAME space, which is what an effect needs.
 *
 * The panel does not fill the frame - it sits inside the stage padding, above
 * the caption band - so panel space is mapped into the box the panel actually
 * occupies. Approximate, deliberately: an effect aimed at the right third of
 * the frame reads as aimed, and nobody is measuring.
 */
export function anchorFor(
  kind: SceneKind,
  panel: ScenePanel | undefined,
  index: number,
  landscape: boolean,
): Anchor {
  // "Nothing to aim at" goes through the same mapping as everything else. The
  // middle of the PANEL is not the middle of the frame - the caption band sits
  // below it - and two paths that both mean "I do not know" must not disagree
  // about where that is.
  const local = !panel || index < 0 ? CENTRE : inPanelSpace(kind, panel, index, landscape);

  // Roughly where the stage puts a panel. Portrait reserves much more room at
  // the bottom for the caption band, so the panel sits higher up the frame.
  const left = landscape ? 0.12 : 0.08;
  const right = landscape ? 0.88 : 0.92;
  const top = landscape ? 0.16 : 0.14;
  const bottom = landscape ? 0.78 : 0.66;

  return {
    x: left + local.x * (right - left),
    y: top + local.y * (bottom - top),
  };
}
