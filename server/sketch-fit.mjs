// ---------------------------------------------------------------------------
// Does what the sketch was told fit what the sketch draws?
//
// Every sketch cuts its labels to the room it has: twelve letters under a
// lever, eighteen in a box, fewer when the box is narrow. It cuts them
// silently. So "Keep dependent sources" went on screen as "Keep dependent
// sourc", "Constant Load Torque" as "Constant L", and a meter told to show
// "Measure Response" displayed the reading "Measure". Half a label is not a
// shorter statement, it is a different one - and nobody chose it.
//
// The only honest way to know whether a label fits is to draw it. So this
// runs the sketch itself, on a canvas of the size the video will give it, with
// a p5 that records every word, and looks for each label it was given. One
// that comes out cut short means the sketch is not drawn.
//
// The sketches are the app's own TypeScript. Node can load them once it is
// told how the app writes its imports (tools/ts-resolve.mjs); where it cannot,
// this check is skipped and says so once, rather than stopping the helper.
// ---------------------------------------------------------------------------

import { sketchTexts } from '../src/remotion/sketch-mock.mjs';

let SKETCHES = null;
try {
  await import('../tools/ts-resolve.mjs');
  ({ SKETCHES } = await import('../src/remotion/sketches.ts'));
} catch (err) {
  console.log('[sketches] label fit is not being checked: ' + (err && err.message ? err.message : err));
}

/** True when the sketches could be loaded, so cutLabels() really looks. */
export const canDrawSketches = () => Boolean(SKETCHES);

/** The canvas a sketch gets: see SketchVisual in src/remotion/Visual.tsx. */
function canvasFor(def, orientation) {
  const landscape = orientation === 'landscape';
  const full = landscape ? 620 : 940;
  const tall = landscape ? 460 : 700;
  return { width: def.shape === 'square' ? Math.min(full, tall) : full, height: tall };
}

const tidy = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

/**
 * The labels this sketch would draw cut short.
 *
 * Returns [{ label, drawn }] - what was asked for and what would appear. A
 * label the sketch does not draw at all is not listed: nothing false is shown
 * by leaving a word out.
 */
export function cutLabels(name, params, items, orientation = 'portrait') {
  const def = SKETCHES && SKETCHES[name];
  if (!def) return [];
  const p = params || {};
  const list = Array.isArray(items) ? items : [];
  const given = [p.labelA, p.labelB, ...list.map((it) => it && it.label)].map(tidy).filter((s) => s.length >= 4);
  if (!given.length) return [];

  const { width, height } = canvasFor(def, orientation);
  const drawn = sketchTexts(def, p, list, width, height);
  const cut = [];
  for (const label of new Set(given)) {
    if (drawn.some((t) => t.includes(label))) continue;
    // The longest beginning of the label that did get drawn, as the end of
    // something - which is what a label cut to length looks like.
    let shown = '';
    for (let n = label.length - 1; n >= 3 && !shown; n--) {
      const head = label.slice(0, n);
      if (drawn.some((t) => t === head || t.endsWith(head) || t.trim() === head.trim())) shown = head.trim();
    }
    if (shown) cut.push({ label, drawn: shown });
  }
  return cut;
}
