// ---------------------------------------------------------------------------
// A p5 that draws nothing and remembers everything.
//
// The sketches are plain functions of a p5 object, so they can be run with no
// canvas at all: the tests do it to prove a sketch draws without crashing, and
// the picture check does it to read back the words and numbers a sketch puts
// on screen - which is the only honest answer to "what does this picture say".
//
// Plain JavaScript, so the server and the tests can import it as it stands.
// ---------------------------------------------------------------------------

export function mockP5(width, height) {
  const bad = [];
  const drawn = [];
  let calls = 0;

  const check = (name, args) => {
    calls++;
    for (const a of args) {
      if (typeof a === 'number' && !Number.isFinite(a)) {
        bad.push(name + '(' + args.join(', ') + ')');
        return;
      }
    }
  };
  // A drawing call, as opposed to a state change. Only these count as "drew".
  const marks = (name) => (...args) => { check(name, args); drawn.push(name); };
  const state = (name) => (...args) => { check(name, args); };

  const p = {
    CENTER: 'center', LEFT: 'left', RIGHT: 'right', TOP: 'top', BOTTOM: 'bottom',
    PIE: 'pie', ROUND: 'round', CORNER: 'corner',

    line: marks('line'), rect: marks('rect'), circle: marks('circle'),
    ellipse: marks('ellipse'), arc: marks('arc'), text: marks('text'),
    vertex: marks('vertex'), point: marks('point'), triangle: marks('triangle'),
    quad: marks('quad'), bezier: marks('bezier'),

    beginShape: state('beginShape'), endShape: state('endShape'),
    push: state('push'), pop: state('pop'),
    fill: state('fill'), noFill: state('noFill'),
    stroke: state('stroke'), noStroke: state('noStroke'),
    strokeWeight: state('strokeWeight'), strokeCap: state('strokeCap'),
    textAlign: state('textAlign'), textSize: state('textSize'),
    textStyle: state('textStyle'),
    translate: state('translate'), rotate: state('rotate'),
    rectMode: state('rectMode'), ellipseMode: state('ellipseMode'),

    radians: (d) => (d * Math.PI) / 180,
    // Deterministic, like the seeded random the real renderer uses.
    random: (a, b) => (b === undefined ? (a === undefined ? 0.5 : 0.5 * a) : a + (b - a) * 0.5),
    color: () => ({ setAlpha() {} }),
    drawingContext: { setLineDash() {} },
    width,
    height,
  };

  return { p, bad, drawn, get calls() { return calls; } };
}

const COLORS = { accent: '#4c9aff', text: '#ffffff', dim: '#94a3b8', good: '#3ddc97', bg: '#0b1020' };

/**
 * Every piece of text a sketch draws, in order, at the end of its scene - when
 * everything it reveals has been revealed. Empty when it draws no words, and
 * when it throws: a sketch that cannot be run says nothing.
 */
export function sketchTexts(def, params = {}, items = [], width = 940, height = 520) {
  if (!def || typeof def.draw !== 'function') return [];
  const { p } = mockP5(width, height);
  const texts = [];
  const rec = { ...p, text: (t) => { const s = String(t ?? '').trim(); if (s) texts.push(s); } };
  try {
    def.draw({ p: rec, frame: 120, time: 4, progress: 1, width, height, params, items, colors: COLORS });
  } catch {
    return [];
  }
  return [...new Set(texts)];
}

/** How many shapes a sketch draws: zero means a blank picture. */
export function sketchMarks(def, params = {}, items = [], width = 940, height = 520) {
  if (!def || typeof def.draw !== 'function') return 0;
  const { p, drawn } = mockP5(width, height);
  try {
    def.draw({ p, frame: 120, time: 4, progress: 1, width, height, params, items, colors: COLORS });
  } catch {
    return 0;
  }
  return drawn.length;
}
