import {
  TRANSITIONS, autoTransitionFor, isTransition, transitionStyle,
} from './transitions.ts';

let fails = 0;
const ok = (n, c, extra='') => { console.log((c?'  ok  ':'  FAIL')+'  '+n+(extra?'  '+extra:'')); if(!c) fails++; };

const names = TRANSITIONS.map((t) => t.id);
const real = names.filter((n) => n !== 'auto');
const STEPS = 41;

/**
 * One cut, sampled.
 *
 * During an overlap the outgoing scene is fully arrived and on its way out,
 * while the incoming one is on its way in and nowhere near leaving. Getting
 * this pairing right is the whole test: a transition that looks fine in
 * isolation can still black the screen when the two halves are put together.
 */
const cut = (name, t, index = 0, bounce = 0.35) => ({
  out: transitionStyle(name, { arriving: 1, leaving: 1 - t, index, bounce }),
  in: transitionStyle(name, { arriving: t, leaving: 1, index: index + 1, bounce }),
});

// --- the catalogue itself -----------------------------------------------------
ok('every entry has an id, label and blurb',
   TRANSITIONS.every((t) => t.id && t.label && t.blurb));
ok('ids are unique', new Set(names).size === names.length);
ok('auto is offered first', names[0] === 'auto');
ok('crossfade is still there', names.includes('crossfade'));
ok('isTransition accepts every id', names.every(isTransition));
ok('isTransition rejects nonsense', !isTransition('sparkle'));

// --- nothing may produce a broken style ---------------------------------------
const bad = [];
for (const name of real) {
  for (let i = 0; i < STEPS; i++) {
    for (const index of [0, 1]) {
      const s = transitionStyle(name, { arriving: i / (STEPS - 1), leaving: 1, index, bounce: 0.5 });
      const text = JSON.stringify(s);
      if (/NaN|Infinity|undefinedpx|undefined%/.test(text)) bad.push(name + '@' + i + ' ' + text);
      if (!(s.opacity >= 0 && s.opacity <= 1)) bad.push(name + ' opacity ' + s.opacity);
    }
  }
}
ok('no transition ever emits NaN, Infinity or a broken unit', bad.length === 0, bad[0] || '');

// --- a cut must never black the screen ----------------------------------------
// This is the one that matters. Both scenes are on screen through the overlap,
// so their opacities have to add up to a lit frame. A transition that dips to
// nothing on both halves at once is a flash of background - which is a bug
// everywhere except `dip`, where it is the entire point.
let worst = { name: '', total: 99 };
for (const name of real) {
  for (let i = 0; i < STEPS; i++) {
    const { out, in: inc } = cut(name, i / (STEPS - 1));
    const total = out.opacity + inc.opacity;
    if (total < worst.total) worst = { name, total, at: i / (STEPS - 1) };
    if (name !== 'dip' && total < 0.95) {
      ok('"' + name + '" keeps the frame lit through the cut', false, 'total=' + total.toFixed(3));
    }
  }
}
ok('no transition except dip lets the frame go dark', worst.name === 'dip' || worst.total >= 0.95,
   'darkest=' + worst.name + ' ' + worst.total.toFixed(3));
ok('dip really does dip', cut('dip', 0.5).out.opacity + cut('dip', 0.5).in.opacity < 0.75);
ok('but dip never goes fully black', worst.total > 0.2, 'darkest=' + worst.total.toFixed(3));

// --- at rest, a scene must be untouched ---------------------------------------
// Most of a scene's life is not a transition. If the settled state is not
// perfectly neutral, every frame in the middle carries a stray scale or blur.
for (const name of real) {
  const s = transitionStyle(name, { arriving: 1, leaving: 1, index: 0, bounce: 0.35 });
  ok('"' + name + '" is neutral once settled',
     s.opacity === 1 && !s.filter && !s.clipPath && !/-?[1-9]/.test(s.transform.replace(/scale\(1\)/, '')),
     JSON.stringify(s));
}

// --- direction alternates so a video does not drift one way -------------------
const evenT = transitionStyle('slide', { arriving: 0.5, leaving: 1, index: 0, bounce: 0 }).transform;
const oddT = transitionStyle('slide', { arriving: 0.5, leaving: 1, index: 1, bounce: 0 }).transform;
ok('consecutive scenes slide in from opposite sides', evenT !== oddT, evenT + ' vs ' + oddT);
ok('and they are mirror images', evenT.replace('-', '') === oddT.replace('-', ''));

// --- a render must be reproducible --------------------------------------------
// Remotion renders frames out of order and across machines. Glitch is the only
// one that looks random, so it is the only one that could have been written
// with Math.random - which would produce a different video every time.
const a = transitionStyle('glitch', { arriving: 0.4, leaving: 1, index: 3, bounce: 0.5 });
const b = transitionStyle('glitch', { arriving: 0.4, leaving: 1, index: 3, bounce: 0.5 });
ok('glitch is deterministic', JSON.stringify(a) === JSON.stringify(b));
ok('glitch still differs between scenes',
   JSON.stringify(transitionStyle('glitch', { arriving: 0.4, leaving: 1, index: 4, bounce: 0.5 })) !== JSON.stringify(a));

// --- unknown names fall back rather than rendering nothing ---------------------
const fallback = transitionStyle('nonsense', { arriving: 0.5, leaving: 1, index: 0, bounce: 0.35 });
const cross = transitionStyle('crossfade', { arriving: 0.5, leaving: 1, index: 0, bounce: 0.35 });
ok('an unknown transition falls back to crossfade', JSON.stringify(fallback) === JSON.stringify(cross));
ok('"auto" resolves rather than rendering itself',
   JSON.stringify(transitionStyle('auto', { arriving: 0.5, leaving: 1, index: 0, bounce: 0.35 })) === JSON.stringify(cross));

// --- auto picks something real for every scene kind ---------------------------
const KINDS = ['hook', 'question', 'options', 'countdown', 'answer', 'explain', 'outro',
               'title', 'metaphor', 'diagram', 'process', 'versus', 'timeline', 'grid', 'motion', 'recap'];
const unmapped = KINDS.filter((k) => !real.includes(autoTransitionFor(k, 0)));
ok('auto returns a real transition for every scene kind', unmapped.length === 0, unmapped.join(', '));
ok('auto never returns auto', !KINDS.some((k) => autoTransitionFor(k, 0) === 'auto'));
ok('the reveal gets the punchy one', autoTransitionFor('answer', 0) === 'zoom');
ok('explanations get the quiet one', autoTransitionFor('explain', 3) === 'crossfade');
ok('an unknown kind still resolves', real.includes(autoTransitionFor('made-up', 0)));

// --- the bounce dial has to actually do something -----------------------------
ok('a springy layout zooms differently from a flat one',
   transitionStyle('zoom', { arriving: 0.3, leaving: 1, index: 0, bounce: 1 }).transform
   !== transitionStyle('zoom', { arriving: 0.3, leaving: 1, index: 0, bounce: 0 }).transform);

// --- input hardening ----------------------------------------------------------
// interpolate() clamps, but a scene shorter than the overlap can hand these
// numbers outside 0-1, and NaN arrives the moment a duration is zero.
const wild = transitionStyle('crossfade', { arriving: 4, leaving: -3, index: 0, bounce: 9 });
ok('out-of-range progress is clamped, not propagated',
   wild.opacity >= 0 && wild.opacity <= 1 && !/NaN/.test(wild.transform), JSON.stringify(wild));
const nan = transitionStyle('zoom', { arriving: NaN, leaving: NaN, index: 0, bounce: NaN });
ok('NaN progress does not reach the DOM', !/NaN/.test(JSON.stringify(nan)), JSON.stringify(nan));

console.log(fails ? '\n' + fails + ' FAILURES' : '\nall transition checks passed');
process.exit(fails ? 1 : 0);
