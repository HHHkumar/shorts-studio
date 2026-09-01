import type { DesignSettings, LayoutName, ThemeMode } from './types';

export interface Theme {
  layout: LayoutName;
  mode: ThemeMode;
  bg: string;
  bgAlt: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  borderWidth: number;
  text: string;
  textDim: string;
  accent: string;
  accentSoft: string;
  correct: string;
  wrong: string;
  fontDisplay: string;
  fontBody: string;
  radius: number;
  displayWeight: number;
  displayTransform: 'none' | 'uppercase';
  displayTracking: number;
  displayItalic: boolean;
  /** Background decoration drawn behind everything. */
  decor: 'plain' | 'rays' | 'grid' | 'burst';
  /** How bouncy the entrance animations are. 0 = calm glide, 1 = big overshoot. */
  bounce: number;
  shadow: string;
  glow: string;
}

// Font stacks only - nothing is downloaded, so the headless-Chrome render
// looks the same as the browser preview.
//
// Every stack ends with Indic-capable faces. The Latin fonts above them carry
// no Kannada, Hindi, Tamil or Telugu glyphs, and without an explicit fallback
// the browser picks one at random - or draws empty boxes.
const INDIC = "'Nirmala UI', Tunga, 'Noto Sans', 'Segoe UI'";

const FONTS = {
  sans: "'Segoe UI', Roboto, 'Helvetica Neue', Arial, " + INDIC + ", sans-serif",
  serif: "Georgia, 'Iowan Old Style', 'Times New Roman', " + INDIC + ", serif",
  mono: "'Cascadia Mono', Consolas, 'DejaVu Sans Mono', 'Courier New', " + INDIC + ", monospace",
  heavy: "'Arial Black', 'Segoe UI Black', Impact, " + INDIC + ", sans-serif",
};

type Recipe = Omit<Theme, 'layout' | 'mode'>;

const RECIPES: Record<LayoutName, Record<ThemeMode, Recipe>> = {
  // --- SIMPLE: clean, high contrast, nothing to distract -------------------
  simple: {
    dark: {
      bg: '#101418', bgAlt: '#161b21', surface: '#1c232b', surfaceAlt: '#232c36',
      border: '#2e3944', borderWidth: 2,
      text: '#f4f7fa', textDim: '#9fb0c0',
      accent: '#4c9aff', accentSoft: 'rgba(76,154,255,0.18)',
      correct: '#3ddc97', wrong: '#ff6b6b',
      fontDisplay: FONTS.sans, fontBody: FONTS.sans,
      radius: 28, displayWeight: 800, displayTransform: 'none', displayTracking: -1,
      displayItalic: false, decor: 'plain', bounce: 0.35,
      shadow: '0 18px 50px rgba(0,0,0,0.45)', glow: 'none',
    },
    light: {
      bg: '#f6f8fb', bgAlt: '#eef2f7', surface: '#ffffff', surfaceAlt: '#f0f4f9',
      border: '#d9e1ea', borderWidth: 2,
      text: '#131a21', textDim: '#5b6b7a',
      accent: '#1668e3', accentSoft: 'rgba(22,104,227,0.12)',
      correct: '#12a06a', wrong: '#d93a3a',
      fontDisplay: FONTS.sans, fontBody: FONTS.sans,
      radius: 28, displayWeight: 800, displayTransform: 'none', displayTracking: -1,
      displayItalic: false, decor: 'plain', bounce: 0.35,
      shadow: '0 18px 44px rgba(20,40,70,0.12)', glow: 'none',
    },
  },

  // --- ELEGANT: serif, airy, museum-poster calm ---------------------------
  elegant: {
    dark: {
      bg: '#12100e', bgAlt: '#1a1613', surface: '#1e1a16', surfaceAlt: '#262019',
      border: '#4a3f31', borderWidth: 1,
      text: '#f5efe4', textDim: '#b3a692',
      accent: '#d9b168', accentSoft: 'rgba(217,177,104,0.14)',
      correct: '#8fbf7a', wrong: '#cf7b6a',
      fontDisplay: FONTS.serif, fontBody: FONTS.sans,
      radius: 6, displayWeight: 600, displayTransform: 'none', displayTracking: 0,
      displayItalic: false, decor: 'rays', bounce: 0.1,
      shadow: '0 24px 60px rgba(0,0,0,0.5)', glow: 'none',
    },
    light: {
      bg: '#faf6ef', bgAlt: '#f2ebdf', surface: '#fffdf9', surfaceAlt: '#f6f0e5',
      border: '#ddd0b8', borderWidth: 1,
      text: '#231d15', textDim: '#6d6153',
      accent: '#9a6b1f', accentSoft: 'rgba(154,107,31,0.10)',
      correct: '#4a7d3a', wrong: '#b0432f',
      fontDisplay: FONTS.serif, fontBody: FONTS.sans,
      radius: 6, displayWeight: 600, displayTransform: 'none', displayTracking: 0,
      displayItalic: false, decor: 'rays', bounce: 0.1,
      shadow: '0 24px 50px rgba(80,60,30,0.14)', glow: 'none',
    },
  },

  // --- NERDY: terminal green on graph paper -------------------------------
  nerdy: {
    dark: {
      bg: '#0b0f0d', bgAlt: '#0f1512', surface: '#111815', surfaceAlt: '#16201b',
      border: '#2b453a', borderWidth: 2,
      text: '#d6ffe8', textDim: '#69917f',
      accent: '#39ff88', accentSoft: 'rgba(57,255,136,0.12)',
      correct: '#39ff88', wrong: '#ff5f56',
      fontDisplay: FONTS.mono, fontBody: FONTS.mono,
      radius: 4, displayWeight: 700, displayTransform: 'none', displayTracking: -1,
      displayItalic: false, decor: 'grid', bounce: 0,
      shadow: 'none', glow: '0 0 24px rgba(57,255,136,0.35)',
    },
    light: {
      bg: '#f4f7f4', bgAlt: '#e9efe9', surface: '#ffffff', surfaceAlt: '#eef3ee',
      border: '#c2d3c8', borderWidth: 2,
      text: '#0d1a13', textDim: '#5a6f62',
      accent: '#0a8f4d', accentSoft: 'rgba(10,143,77,0.10)',
      correct: '#0a8f4d', wrong: '#c0392b',
      fontDisplay: FONTS.mono, fontBody: FONTS.mono,
      radius: 4, displayWeight: 700, displayTransform: 'none', displayTracking: -1,
      displayItalic: false, decor: 'grid', bounce: 0,
      shadow: '0 8px 24px rgba(10,60,30,0.10)', glow: 'none',
    },
  },

  // --- FLASHY: loud, fast, built for the scroll feed -----------------------
  flashy: {
    dark: {
      bg: '#14031f', bgAlt: '#2a0846',
      surface: 'rgba(255,255,255,0.07)', surfaceAlt: 'rgba(255,255,255,0.13)',
      border: '#ff2ec4', borderWidth: 4,
      text: '#ffffff', textDim: '#d8b7ff',
      accent: '#ffd400', accentSoft: 'rgba(255,212,0,0.18)',
      correct: '#00ffa3', wrong: '#ff3b6b',
      fontDisplay: FONTS.heavy, fontBody: FONTS.sans,
      radius: 34, displayWeight: 900, displayTransform: 'uppercase', displayTracking: -2,
      displayItalic: true, decor: 'burst', bounce: 1,
      shadow: '0 20px 60px rgba(255,46,196,0.35)', glow: '0 0 40px rgba(255,212,0,0.5)',
    },
    light: {
      bg: '#fff3d6', bgAlt: '#ffd9e8', surface: '#ffffff', surfaceAlt: '#fff7e6',
      border: '#ff2f87', borderWidth: 4,
      text: '#1a0a20', textDim: '#7a4a63',
      accent: '#ff7a00', accentSoft: 'rgba(255,122,0,0.16)',
      correct: '#00a86b', wrong: '#e0245e',
      fontDisplay: FONTS.heavy, fontBody: FONTS.sans,
      radius: 34, displayWeight: 900, displayTransform: 'uppercase', displayTracking: -2,
      displayItalic: true, decor: 'burst', bounce: 1,
      shadow: '0 18px 50px rgba(255,47,135,0.28)', glow: '0 0 30px rgba(255,122,0,0.35)',
    },
  },
};

export const LAYOUT_INFO: { name: LayoutName; label: string; blurb: string }[] = [
  { name: 'simple', label: 'Simple', blurb: 'Clean and readable. Safe choice for any subject.' },
  { name: 'elegant', label: 'Elegant', blurb: 'Serif type, calm pacing. Feels like a documentary.' },
  { name: 'nerdy', label: 'Nerdy', blurb: 'Terminal green on graph paper. Great for code and maths.' },
  { name: 'flashy', label: 'Flashy', blurb: 'Loud colours, big bounce. Built for the scroll feed.' },
];

export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const n = parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(n)) return 'rgba(128,128,128,' + alpha + ')';
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + alpha + ')';
}

export function getTheme(design: DesignSettings): Theme {
  const recipe = RECIPES[design.layout][design.mode];
  const custom = design.accent && design.accent.trim();
  const accent = custom ? design.accent.trim() : recipe.accent;
  return {
    ...recipe,
    accent,
    accentSoft: custom ? hexToRgba(accent, 0.16) : recipe.accentSoft,
    layout: design.layout,
    mode: design.mode,
  };
}

export const DEFAULT_DESIGN: DesignSettings = {
  mode: 'dark',
  layout: 'flashy',
  accent: '',
  showCaptions: true,
  showProgressBar: true,
  countdownSeconds: 4,
  scenePaddingSeconds: 0.35,
  trimTrailingSilence: true,
  showVisuals: true,
  showMotif: true,
  ambient: 'auto',
  ambientIntensity: 0.6,
  showStock: true,
  stockOpacity: 0.45,
  music: 'calm',
  musicVolume: 0.22,
  customMusicSrc: '',
  sfx: true,
  sfxVolume: 0.5,
  orientation: 'portrait',
};
