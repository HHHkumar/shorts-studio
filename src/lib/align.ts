/**
 * Where text sits on the frame: centred, or flush left.
 *
 * Kept apart from theme.ts, and free of React and Remotion, so the rule can be
 * tested without rendering anything.
 *
 * Only blocks of TEXT follow this - headlines, the read-along line, titles,
 * captions. Anything whose position is geometry stays centred whatever the
 * setting: a label under a timeline dot, the name under an icon in a tile, a
 * diagram and its caption. Left-aligning those would detach a label from the
 * thing it names, which is a drawing that lies about what it shows.
 */

export type Align = 'left' | 'center';
export type AlignSetting = 'auto' | Align;

export const ALIGN_OPTIONS: { id: AlignSetting; label: string; blurb: string }[] = [
  { id: 'auto', label: 'Match the look', blurb: 'Whatever the layout was designed for.' },
  { id: 'center', label: 'Centred', blurb: 'Symmetrical. Reads well on a phone held upright.' },
  { id: 'left', label: 'Flush left', blurb: 'Asymmetric, like an editorial page or a slide deck.' },
];

/** The creator's choice wins; 'auto', or anything unrecognised, defers to the look. */
export function resolveAlign(setting: string | undefined, layoutDefault: Align): Align {
  return setting === 'left' || setting === 'center' ? setting : layoutDefault;
}

/** For `textAlign`. */
export function textAlignFor(align: Align): 'left' | 'center' {
  return align === 'left' ? 'left' : 'center';
}

/** For `alignItems` and `justifyContent` along the line of text. */
export function flexAlignFor(align: Align): 'flex-start' | 'center' {
  return align === 'left' ? 'flex-start' : 'center';
}
