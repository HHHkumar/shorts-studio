// ---------------------------------------------------------------------------
// Layouts ported from Claude Design systems.
//
// GENERATED FILE - do not edit by hand. Every change here is overwritten.
//
//     node tools/import-design.mjs
//
// The sources are the folders under design-kits/. To change a look, update its
// kit and re-run the command; theme.ts turns each entry into a layout.
// ---------------------------------------------------------------------------

import type { Align } from './align';

export type DesignLookSlug = 'organic';

/** How a font degrades when its webfont is not installed. theme.ts owns the stacks. */
export type FontFallback = 'sans' | 'serif' | 'mono' | 'heavy';

export interface DesignFont {
  family: string;
  fallback: FontFallback;
}

export interface DesignRecipe {
  bg: string;
  bgAlt: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textDim: string;
  accent: string;
  accentSoft: string;
  correct: string;
  wrong: string;
  shadow: string;
  glow: string;
  fontDisplay: DesignFont;
  fontBody: DesignFont;
  displayWeight: number;
  radius: number;
  borderWidth: number;
  displayTransform: 'none' | 'uppercase';
  displayTracking: number;
  displayItalic: boolean;
  decor: 'plain' | 'rays' | 'grid' | 'burst';
  bounce: number;
}

export interface DesignLook {
  slug: DesignLookSlug;
  label: string;
  blurb: string;
  align: Align;
  /** The Claude Design project this was pulled from. */
  projectId: string;
  /** The ground the system was designed on. The other mode is derived. */
  band: 'light' | 'dark';
  light: DesignRecipe;
  dark: DesignRecipe;
}

export const DESIGN_LOOKS: DesignLook[] = [
  {
    slug: 'organic',
    label: 'Organic',
    blurb: 'Warm, rounded and a little playful. From your Claude Design system.',
    align: 'left',
    projectId: 'afecc451-e7ec-4e10-9013-7d519e2cee53',
    band: 'light',
    light: {
      bg: '#f5ead8',
      bgAlt: '#eee7db',
      surface: '#ebddc5',
      surfaceAlt: '#f9f4ed',
      border: '#dcd3c4',
      text: '#201e1d',
      textDim: '#645c50',
      accent: '#c67139',
      accentSoft: 'rgba(198,113,57,0.16)',
      correct: '#728157',
      wrong: '#b3261e',
      shadow: '0 12px 32px rgba(46,43,37,0.22)',
      glow: '0 0 40px rgba(198,113,57,0.28)',
      fontDisplay: { family: 'Caprasimo', fallback: 'heavy' },
      fontBody: { family: 'Figtree', fallback: 'sans' },
      displayWeight: 400,
      radius: 28,
      borderWidth: 2,
      displayTransform: 'none',
      displayTracking: -1,
      displayItalic: false,
      decor: 'plain',
      bounce: 0.45,
    },
    dark: {
      bg: '#201e1d',
      bgAlt: '#2e2b25',
      surface: '#474238',
      surfaceAlt: '#645c50',
      border: '#82796a',
      text: '#f9f4ed',
      textDim: '#c0b6a5',
      accent: '#f6a06b',
      accentSoft: 'rgba(246,160,107,0.18)',
      correct: '#aebf92',
      wrong: '#ef6b5b',
      shadow: '0 14px 36px rgba(0,0,0,0.45)',
      glow: '0 0 40px rgba(246,160,107,0.32)',
      fontDisplay: { family: 'Caprasimo', fallback: 'heavy' },
      fontBody: { family: 'Figtree', fallback: 'sans' },
      displayWeight: 400,
      radius: 28,
      borderWidth: 2,
      displayTransform: 'none',
      displayTracking: -1,
      displayItalic: false,
      decor: 'plain',
      bounce: 0.45,
    },
  },
];
