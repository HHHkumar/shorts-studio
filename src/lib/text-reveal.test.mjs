import { TEXT_REVEALS, isReveal, wordStyle } from './text-reveal.ts';

let fails = 0;
const ok = (n, c, extra='') => { console.log((c?'  ok  ':'  FAIL')+'  '+n+(extra?'  '+extra:'')); if(!c) fails++; };

const COLORS = { text: '#ffffff', accent: '#4c9aff', ghost: 'rgba(255,255,255,0.32)' };
const names = TEXT_REVEALS.map((r) => r.id);

const at = (reveal, over = {}) =>
  wordStyle(reveal, { spoken: true, current: false, enter: 1, ...over }, COLORS);

// --- the catalogue ------------------------------------------------------------
ok('every reveal has an id, label and blurb', TEXT_REVEALS.every((r) => r.id && r.label && r.blurb));
ok('ids are unique', new Set(names).size === names.length);
ok('fade is offered first, and is the default', names[0] === 'fade');
ok('isReveal accepts every id', names.every(isReveal));
ok('isReveal rejects nonsense', !isReveal('sparkle'));

// --- nothing may emit a broken style ------------------------------------------
const bad = [];
for (const name of names) {
  for (const spoken of [true, false]) {
    for (const current of [true, false]) {
      for (let i = 0; i <= 10; i++) {
        const s = wordStyle(name, { spoken, current, enter: i / 10 }, COLORS);
        const text = JSON.stringify(s);
        if (/NaN|Infinity|undefinedpx/.test(text)) bad.push(name + ' ' + text);
        if (!(s.opacity >= 0 && s.opacity <= 1)) bad.push(name + ' opacity ' + s.opacity);
        if (!s.color) bad.push(name + ' has no colour');
        if (!s.transform) bad.push(name + ' has no transform');
      }
    }
  }
}
ok('no reveal emits NaN, a bad unit or a missing value', bad.length === 0, bad[0] || '');

// --- the rule the whole read-along model rests on -----------------------------
// A word that has been spoken must be fully readable. If any style leaves a
// said word faint, the viewer is reading behind the voice, which is the one
// thing this component exists to prevent.
const dim = names.filter((n) => at(n).opacity < 1);
ok('every spoken word ends up fully opaque', dim.length === 0, dim.join(', '));

const unsettled = names.filter((n) => {
  const t = at(n).transform;
  return /translateY\(-?[1-9]/.test(t) || /scale\(0/.test(t);
});
ok('every spoken word settles into place', unsettled.length === 0, unsettled.join(', '));

// --- the current word must be findable ----------------------------------------
const notMarked = names.filter((n) => {
  const cur = at(n, { current: true });
  const plain = at(n);
  return cur.color === plain.color && cur.transform === plain.transform && !cur.marker;
});
ok('every reveal distinguishes the word being spoken', notMarked.length === 0, notMarked.join(', '));

ok('most reveals use the accent for the current word',
   names.filter((n) => at(n, { current: true }).color === COLORS.accent).length >= names.length - 1);
ok('marker uses a bar instead of a colour, and says so',
   at('marker', { current: true }).marker === true && at('marker', { current: true }).color === COLORS.text);
ok('no other reveal asks for the bar',
   names.filter((n) => n !== 'marker').every((n) => at(n, { current: true }).marker === false));

// --- read-ahead is the thing that actually differs ----------------------------
// This is the choice a creator is making, so it has to be real: `type` must
// withhold the word entirely, and the calm ones must let it be glimpsed.
ok('typewriter shows nothing before it is spoken',
   wordStyle('type', { spoken: false, current: false, enter: 0 }, COLORS).opacity === 0);
ok('fade lets the viewer read a shade ahead',
   wordStyle('fade', { spoken: false, current: false, enter: 0 }, COLORS).opacity > 0.2);
ok('focus keeps the shape but not the detail',
   /blur\(/.test(wordStyle('blur', { spoken: false, current: false, enter: 0 }, COLORS).filter || ''));
ok('an unspoken word is never given the accent',
   names.every((n) => wordStyle(n, { spoken: false, current: false, enter: 0 }, COLORS).color !== COLORS.accent));

// --- entrances have to animate, not jump --------------------------------------
const animated = ['pop', 'rise', 'bounce', 'blur'];
for (const name of animated) {
  const start = at(name, { enter: 0 }).transform + (at(name, { enter: 0 }).filter || '');
  const end = at(name, { enter: 1 }).transform + (at(name, { enter: 1 }).filter || '');
  ok('"' + name + '" actually moves between the start and end of its entrance', start !== end);
}
ok('bounce overshoots past its final size',
   Math.max(...[0.2, 0.4, 0.6, 0.8].map((e) => Number(at('bounce', { enter: e }).transform.match(/scale\(([\d.]+)/)[1]))) > 1);

// --- fallbacks ----------------------------------------------------------------
ok('an unknown reveal falls back to fade',
   JSON.stringify(at('nonsense', { current: true })) === JSON.stringify(at('fade', { current: true })));
const wild = wordStyle('pop', { spoken: true, current: true, enter: NaN }, COLORS);
ok('a NaN entrance does not reach the DOM', !/NaN/.test(JSON.stringify(wild)), JSON.stringify(wild));
const over = wordStyle('rise', { spoken: true, current: false, enter: 9 }, COLORS);
ok('an out-of-range entrance is clamped', over.transform === 'translateY(0px) scale(1)', over.transform);

console.log(fails ? '\n' + fails + ' FAILURES' : '\nall text reveal checks passed');
process.exit(fails ? 1 : 0);
