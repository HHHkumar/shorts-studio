// ---------------------------------------------------------------------------
// Turn Claude Design systems into video layouts.
//
//     node tools/import-design.mjs
//
// Each folder under design-kits/ is one design system pulled from a Claude
// Design project: its theme.json, the :root token block of its styles.css
// (tokens.css) and a source.json saying where it came from. This reads every
// kit and writes src/lib/design-looks.ts, which theme.ts turns into layouts
// alongside the four built-in ones.
//
// Why generated rather than hand-ported: the first port (Organic) was typed in
// by hand, and every further look would have been another forty hand-copied
// hex values with nothing checking them. Now the tokens are the source of
// truth, the port is a function of them, and import-design.test.mjs checks the
// result for readable contrast in both modes - so a new look cannot quietly
// ship grey text on a grey ground.
//
// Run it after adding or updating a kit. The test fails if you forget.
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const KITS = path.join(ROOT, 'design-kits');
export const OUT = path.join(ROOT, 'src', 'lib', 'design-looks.ts');

/** Names the four hand-built layouts already use. A kit may not shadow one. */
export const BUILT_IN = ['simple', 'elegant', 'nerdy', 'flashy'];

// --- colour arithmetic --------------------------------------------------------

export function parseHex(hex) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return null;
  const full = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const toHex = (rgb) => '#' + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');

export function rgba(hex, alpha) {
  const c = parseHex(hex);
  return c ? 'rgba(' + c.join(',') + ',' + alpha + ')' : 'rgba(128,128,128,' + alpha + ')';
}

/** WCAG relative luminance. */
export function luminance(hex) {
  const c = parseHex(hex);
  if (!c) return 0;
  const [r, g, b] = c.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, 1 to 21. */
export function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Hue in degrees, 0-360, or null for a grey. */
export function hue(hex) {
  const c = parseHex(hex);
  if (!c) return null;
  const [r, g, b] = c.map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d < 0.04) return null;
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

/** Straight sRGB mix, t=0 is a, t=1 is b. Only used between two steps of one ramp. */
export function mix(a, b, t) {
  const ca = parseHex(a);
  const cb = parseHex(b);
  if (!ca || !cb) return a;
  return toHex(ca.map((v, i) => v + (cb[i] - v) * t));
}

/** The first hex colour in a string, e.g. inside a color-mix(). */
const firstHex = (s) => (/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/i.exec(String(s || '')) || [null])[0];

// --- reading a kit ------------------------------------------------------------

/** Every `--name: value;` inside the css, comments removed. */
export function parseTokens(css) {
  const out = {};
  const clean = String(css || '').replace(/\/\*[\s\S]*?\*\//g, '');
  const re = /--([a-z0-9-]+)\s*:\s*([^;]+);/gi;
  let m;
  while ((m = re.exec(clean))) out[m[1]] = m[2].trim();
  return out;
}

export function slugify(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/**
 * A kit's one-line description for the layout picker: the opening clause of
 * the project's own summary, without the "Organic is" in front.
 */
export function blurbFrom(summary, name) {
  let s = String(summary || '').trim();
  if (!s) return 'From your Claude Design system.';
  s = s.split(/[:.;]/)[0].trim();
  const lead = new RegExp('^' + String(name || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s+(is|has)\\s+', 'i');
  s = s.replace(lead, '');
  s = s.charAt(0).toUpperCase() + s.slice(1);
  return s + '. From your Claude Design system.';
}

/**
 * Which fallback stack a font class degrades to. The stacks themselves live in
 * theme.ts next to the built-in ones, so every layout shares one Indic fallback.
 */
export function fallbackFor(fontClass) {
  const c = String(fontClass || '').toLowerCase();
  if (c.includes('mono')) return 'mono';
  if (c.includes('serif') && !c.includes('sans')) return 'serif';
  if (c.includes('display') || c.includes('slab') || c.includes('heavy')) return 'heavy';
  return 'sans';
}

const px = (v, fallback) => {
  const n = parseFloat(String(v || ''));
  return Number.isFinite(n) ? n : fallback;
};

// --- the port -----------------------------------------------------------------

/**
 * One kit's tokens, as the two recipes a layout needs.
 *
 * The ground the system was designed on is quoted: bg, surface, text and accent
 * are the published tokens, and the supporting steps come off the neutral ramp,
 * where the same step carries the same visual weight in every role.
 *
 * The other ground is derived, and follows the rule Claude Design's own readmes
 * give: on a dark ground the accent moves to step 400, on a light one to 600,
 * because the base sits too close to an opposite ground to read.
 */
export function recipesFor(theme, tokens) {
  const t = (name, fallback) => (tokens[name] && parseHex(tokens[name]) ? tokens[name] : fallback);
  const pal = theme.palette || {};
  const bgToken = t('color-bg', pal.bg);
  const textToken = t('color-text', pal.text);
  const band = pal.band === 'dark' || luminance(bgToken) < 0.2 ? 'dark' : 'light';

  const n = (step, fallback) => t('color-neutral-' + step, fallback);
  const a = (step, fallback) => t('color-accent-' + step, fallback);
  const a2 = (step) => t('color-accent-2-' + step, null);

  const accent = t('color-accent', pal.accent);
  const accent2 = t('color-accent-2', pal.accent2 || null);
  const shape = {
    fontDisplay: {
      family: (theme.fonts && theme.fonts.heading && theme.fonts.heading.family) || '',
      fallback: fallbackFor(theme.fonts && theme.fonts.heading && theme.fonts.heading.class),
    },
    fontBody: {
      family: (theme.fonts && theme.fonts.body && theme.fonts.body.family) || '',
      fallback: fallbackFor(theme.fonts && theme.fonts.body && theme.fonts.body.class),
    },
    // The token when the kit sets one - Caprasimo, for instance, ships a
    // single 400 weight - otherwise the heaviest weight the heading loads.
    displayWeight: px(tokens['font-heading-weight'],
      Math.max(400, ...((theme.fonts && theme.fonts.heading && theme.fonts.heading.weights) || [700]))),
    // Containers take the large radius: "over-round" in Claude Design terms.
    radius: px(tokens['radius-lg'], px(theme.radius, 16) * 1.75),
    borderWidth: theme.frame === 'sharp' || theme.frame === 'hairline' ? 1 : 2,
    displayTransform: 'none',
    displayTracking: -1,
    displayItalic: false,
    decor: 'plain',
    bounce: theme.frame === 'rounded' ? 0.45 : 0.25,
  };

  // Right and wrong are meanings, not brand colours. The second accent stands
  // in for "right" only when it is actually green; otherwise a green and a red
  // are chosen for the ground, so a red brand accent never reads as correct.
  const greenish = (hex) => {
    const h = hue(hex);
    return h !== null && h >= 75 && h <= 170;
  };

  const light = (native) => {
    // Derived from a dark system: the two grounds swap roles, so its ink
    // becomes the page and its page becomes the ink - the mirror of dark().
    const bg = native ? bgToken : textToken;
    const text = native ? textToken : bgToken;
    const acc = native ? accent : a(600, accent);
    return {
      bg,
      bgAlt: n(200, mix(bg, text, 0.05)),
      surface: native ? t('color-surface', pal.surface || n(200, bg)) : n(200, bg),
      surfaceAlt: n(100, bg),
      border: n(300, mix(bg, text, 0.16)),
      text,
      textDim: n(700, mix(text, bg, 0.4)),
      accent: acc,
      accentSoft: rgba(acc, 0.16),
      correct: accent2 && greenish(accent2) ? (a2(600) || accent2) : '#2e7d4f',
      wrong: '#b3261e',
      shadow: native && tokens['shadow-lg'] && firstHex(tokens['shadow-lg'])
        ? '0 12px 32px ' + rgba(firstHex(tokens['shadow-lg']), 0.22)
        : '0 12px 32px rgba(20,20,20,0.16)',
      glow: '0 0 40px ' + rgba(acc, 0.28),
      ...shape,
    };
  };

  const dark = (native) => {
    const bg = native ? bgToken : textToken;
    const text = native ? textToken : n(100, '#f5f5f5');
    const acc = native ? accent : a(400, accent);
    return {
      bg,
      bgAlt: n(900, mix(bg, text, 0.05)),
      surface: native ? t('color-surface', n(800, bg)) : n(800, mix(bg, text, 0.1)),
      surfaceAlt: n(700, mix(bg, text, 0.16)),
      border: n(600, mix(bg, text, 0.3)),
      text,
      textDim: n(400, mix(text, bg, 0.35)),
      accent: acc,
      accentSoft: rgba(acc, 0.18),
      correct: accent2 && greenish(accent2) ? (a2(400) || accent2) : '#6fcf97',
      wrong: '#ef6b5b',
      shadow: '0 14px 36px rgba(0,0,0,0.45)',
      glow: '0 0 40px ' + rgba(acc, 0.32),
      ...shape,
    };
  };

  return band === 'dark'
    ? { band, dark: dark(true), light: light(false) }
    : { band, light: light(true), dark: dark(false) };
}

/** Every kit on disk, read and ported, in folder order. Throws on a bad kit. */
export function readKits(dir = KITS) {
  if (!fs.existsSync(dir)) return [];
  const looks = [];
  for (const folder of fs.readdirSync(dir).sort()) {
    const base = path.join(dir, folder);
    if (!fs.statSync(base).isDirectory()) continue;
    const themePath = path.join(base, 'theme.json');
    if (!fs.existsSync(themePath)) continue;
    const theme = JSON.parse(fs.readFileSync(themePath, 'utf8'));
    const tokensPath = path.join(base, 'tokens.css');
    const tokens = fs.existsSync(tokensPath) ? parseTokens(fs.readFileSync(tokensPath, 'utf8')) : {};
    const sourcePath = path.join(base, 'source.json');
    const source = fs.existsSync(sourcePath) ? JSON.parse(fs.readFileSync(sourcePath, 'utf8')) : {};

    const slug = slugify(source.builtin || folder);
    if (!slug) throw new Error('design-kits/' + folder + ': cannot make a layout name from it');
    if (BUILT_IN.includes(slug)) {
      throw new Error('design-kits/' + folder + ': "' + slug + '" is already a built-in layout - rename the folder');
    }
    if (looks.some((l) => l.slug === slug)) {
      throw new Error('design-kits/' + folder + ': two kits both want the name "' + slug + '"');
    }
    const name = theme.name || folder;
    const layoutStyle = String(theme.layoutStyle || '').toLowerCase();
    looks.push({
      slug,
      label: name,
      blurb: blurbFrom(source.summary, name),
      align: layoutStyle === 'left' ? 'left' : 'center',
      projectId: source.projectId || '',
      ...recipesFor(theme, tokens),
    });
  }
  return looks;
}

// --- the generated file -------------------------------------------------------

const q = (s) => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";

function recipeSource(r, indent) {
  const pad = ' '.repeat(indent);
  const lines = Object.entries(r).map(([k, v]) => {
    let val;
    if (v && typeof v === 'object') val = '{ family: ' + q(v.family) + ', fallback: ' + q(v.fallback) + ' }';
    else if (typeof v === 'number') val = String(Math.round(v * 1000) / 1000);
    else if (typeof v === 'boolean') val = String(v);
    else val = q(v);
    return pad + k + ': ' + val + ',';
  });
  return '{\n' + lines.join('\n') + '\n' + ' '.repeat(indent - 2) + '}';
}

export function buildSource(looks = readKits()) {
  const slugs = looks.map((l) => q(l.slug));
  const entries = looks.map((l) => `  {
    slug: ${q(l.slug)},
    label: ${q(l.label)},
    blurb: ${q(l.blurb)},
    align: ${q(l.align)},
    projectId: ${q(l.projectId)},
    band: ${q(l.band)},
    light: ${recipeSource(l.light, 6)},
    dark: ${recipeSource(l.dark, 6)},
  },`);

  return `// ---------------------------------------------------------------------------
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

export type DesignLookSlug = ${slugs.length ? slugs.join(' | ') : 'never'};

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
${entries.join('\n')}
];
`;
}

// Only write when run directly, so the test can import buildSource() freely.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const looks = readKits();
  const written = buildSource(looks);
  const existing = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  const names = looks.map((l) => l.label).join(', ') || 'none';
  if (existing === written) {
    console.log('design looks already up to date (' + looks.length + ': ' + names + ')');
  } else {
    fs.writeFileSync(OUT, written);
    console.log('wrote ' + looks.length + ' design looks to src/lib/design-looks.ts (' + names + ')');
  }
}
