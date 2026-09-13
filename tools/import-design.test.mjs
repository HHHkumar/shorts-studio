import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  BUILT_IN, OUT, blurbFrom, buildSource, contrast, fallbackFor, hue, parseTokens, readKits, recipesFor,
} from './import-design.mjs';

let fails = 0;
const ok = (n, c, extra = '') => { console.log((c ? '  ok  ' : '  FAIL') + '  ' + n + (extra ? '  ' + extra : '')); if (!c) fails++; };
const hex = /^#[0-9a-f]{6}$/i;

// --- the generated file is current -------------------------------------------
const looks = readKits();
ok('design-looks.ts matches the kits on disk',
   fs.existsSync(OUT) && buildSource(looks) === fs.readFileSync(OUT, 'utf8'),
   'run: node tools/import-design.mjs');
ok('at least one kit is present', looks.length >= 1);

// --- reading tokens -----------------------------------------------------------
const toks = parseTokens(`:root {
  /* --color-bg: #000000; a comment is not a token */
  --color-bg: #f5ead8;
  --radius-lg: 28px;
  --shadow-lg: 0 12px 32px color-mix(in srgb, #2e2b25 22%, transparent);
}`);
ok('reads a colour token', toks['color-bg'] === '#f5ead8');
ok('ignores tokens inside comments', Object.keys(toks).filter((k) => k === 'color-bg').length === 1 && toks['color-bg'] !== '#000000');
ok('reads a value with spaces and parentheses', toks['shadow-lg'].includes('color-mix'));

ok('a display face falls back to the heavy stack', fallbackFor('display') === 'heavy');
ok('a humanist face falls back to sans', fallbackFor('humanist') === 'sans');
ok('a serif falls back to serif', fallbackFor('transitional serif') === 'serif');
ok('a sans-serif is not mistaken for a serif', fallbackFor('geometric sans-serif') === 'sans');
ok('a mono face falls back to mono', fallbackFor('monospace') === 'mono');

ok('the blurb drops "Name is" and stops at the first clause',
   blurbFrom('Organic is warm, rounded and a little playful: a cream ground.', 'Organic')
     === 'Warm, rounded and a little playful. From your Claude Design system.');
ok('no summary still gives a blurb', blurbFrom('', 'X').length > 0);

// --- Organic, against its published tokens ------------------------------------
const organic = looks.find((l) => l.slug === 'organic');
ok('Organic is imported', !!organic);
if (organic) {
  const L = organic.light;
  ok('designed on a light ground', organic.band === 'light');
  ok('light bg is the published token', L.bg === '#f5ead8');
  ok('light surface is the published token', L.surface === '#ebddc5');
  ok('light text is the published token', L.text === '#201e1d');
  ok('light accent is the published token', L.accent === '#c67139');
  ok('dim text is neutral-700', L.textDim === '#645c50');
  ok('sage stands in for right, because it is green', L.correct === '#728157');
  ok('flush left, as its layoutStyle says', organic.align === 'left');
  ok('Caprasimo ships only 400, and the token says so', L.displayWeight === 400);
  ok('containers take the large radius', L.radius === 28);
  ok('fonts are named', L.fontDisplay.family === 'Caprasimo' && L.fontBody.family === 'Figtree');
  ok('dark accent follows the dark-ground rule: step 400', organic.dark.accent === '#f6a06b');
  ok('dark ground is the system ink', organic.dark.bg === '#201e1d');
}

// --- every look, both modes: readable, and meanings kept apart ---------------
for (const look of looks) {
  ok(look.slug + ': not a built-in name', !BUILT_IN.includes(look.slug));
  ok(look.slug + ': has a label and blurb', !!look.label && !!look.blurb);
  for (const mode of ['light', 'dark']) {
    const r = look[mode];
    const tag = look.slug + '/' + mode + ': ';
    const colours = ['bg', 'bgAlt', 'surface', 'surfaceAlt', 'border', 'text', 'textDim', 'accent', 'correct', 'wrong'];
    const bad = colours.filter((k) => !hex.test(r[k]));
    ok(tag + 'every colour is a hex value', bad.length === 0, bad.join(', '));
    if (bad.length) continue;

    const body = contrast(r.text, r.bg);
    ok(tag + 'text on the ground is readable (>= 7)', body >= 7, body.toFixed(2));
    const onCard = contrast(r.text, r.surface);
    ok(tag + 'text on a card is readable (>= 4.5)', onCard >= 4.5, onCard.toFixed(2));
    const dim = contrast(r.textDim, r.bg);
    ok(tag + 'dim text still reads (>= 4.5)', dim >= 4.5, dim.toFixed(2));
    const acc = contrast(r.accent, r.bg);
    ok(tag + 'accent reads as large text (>= 3)', acc >= 3, acc.toFixed(2));
    const right = contrast(r.correct, r.bg);
    const wrong = contrast(r.wrong, r.bg);
    ok(tag + 'right and wrong read on the ground (>= 3)', right >= 3 && wrong >= 3, right.toFixed(2) + ' / ' + wrong.toFixed(2));
    const gap = Math.abs(((hue(r.correct) - hue(r.wrong) + 540) % 360) - 180);
    ok(tag + 'right and wrong are different hues (>= 60 deg)', gap >= 60, gap.toFixed(0));
    ok(tag + 'the card is distinguishable from the ground', r.surface !== r.bg);
    ok(tag + 'no NaN reaches a shadow or glow', !/NaN/.test(r.shadow + r.glow));
    ok(tag + 'font stacks have a fallback', !!r.fontDisplay.fallback && !!r.fontBody.fallback);
  }
}

// --- a red second accent is never used as "right" -----------------------------
const red = recipesFor(
  { name: 'Alarm', palette: { band: 'light', bg: '#ffffff', text: '#111111', accent: '#1f5fbf', accent2: '#c0392b' } },
  { 'color-accent-2': '#c0392b', 'color-accent-2-600': '#a93226' },
);
ok('a red second accent does not become the "correct" colour', red.light.correct !== '#a93226' && red.light.correct !== '#c0392b');

// --- a dark-ground system quotes its dark mode and derives light --------------
const night = recipesFor(
  { name: 'Night', palette: { band: 'dark', bg: '#101014', surface: '#1b1b22', text: '#f2f2f5', accent: '#8a7dff' } },
  { 'color-bg': '#101014', 'color-surface': '#1b1b22', 'color-text': '#f2f2f5', 'color-accent': '#8a7dff' },
);
ok('a dark system keeps its own dark ground', night.band === 'dark' && night.dark.bg === '#101014');
ok('and derives a light ground from its ink', night.light.bg === '#f2f2f5');
ok('and puts dark text on it', contrast(night.light.text, night.light.bg) >= 7);

// --- a kit may not shadow a built-in layout -----------------------------------
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kits-'));
fs.mkdirSync(path.join(tmp, 'simple'));
fs.writeFileSync(path.join(tmp, 'simple', 'theme.json'), JSON.stringify({ name: 'Simple', palette: { bg: '#ffffff', text: '#000000', accent: '#0055ff' } }));
let refused = false;
try { readKits(tmp); } catch (e) { refused = /built-in/.test(e.message); }
ok('a kit named after a built-in layout is refused', refused);
fs.rmSync(tmp, { recursive: true, force: true });

console.log(fails ? '\n' + fails + ' FAILURES' : '\nall design import checks passed');
process.exit(fails ? 1 : 0);
