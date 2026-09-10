import type { SketchDef } from './sketches';
import {
  arcArrow, arrow, axes, bars, box, bubble, caption, clean, curve, junction, labels, num,
  resistor, safe, setDash, spread, stagger, tint, title, values, wire,
} from './sketch-parts';

// ---------------------------------------------------------------------------
// Coverage, rather than variety.
//
// The first two files were written by asking "what would be nice to have". This
// one was written from a report: tools/sketch-coverage.mjs matches every
// sub-topic in the app against the library and lists the ones with nothing at
// all. Whole subjects were empty - psychology, economics, digital electronics,
// English comprehension - which is why a video about them fell back to the same
// two or three loosely-related diagrams and looked repetitive.
//
// So every entry below exists because a real sub-topic had no candidate. Run
// the report after adding to it; the number that matters is the bare count, not
// the total.
// ---------------------------------------------------------------------------

const wide = (
  label: string, describe: string, uses: string, draw: SketchDef['draw'],
): SketchDef => ({ shape: 'wide', label, describe, uses, draw });

const square = (
  label: string, describe: string, uses: string, draw: SketchDef['draw'],
): SketchDef => ({ shape: 'square', label, describe, uses, draw });

/** A labelled row of boxes, the shape half of these diagrams want. */
const rowOf = (
  p: Parameters<SketchDef['draw']>[0]['p'], names: string[], y: number, width: number,
  height: number, colors: Parameters<SketchDef['draw']>[0]['colors'], progress: number,
  litIndex = -1,
) => {
  const xs = spread(names.length, width * 0.18, width * 0.82);
  const w = Math.min((width * 0.64) / safe(names.length) - 14, 200);
  names.forEach((n, i) => {
    const on = stagger(progress, i, 0.12);
    if (on <= 0) return;
    box(p, xs[i], y, w, height, n, colors, { lit: i === litIndex });
  });
  return xs;
};

export const MORE_SKETCHES: Record<string, SketchDef> = {

  // =========================================================================
  // English language and comprehension
  // =========================================================================

  'parts-of-speech': wide('Parts of speech',
    'a sentence with each word tagged by its part of speech. Use for: grammar, error spotting, sentence structure',
    'items (3-6 words, label is the word, symbol is the tag)',
    ({ p, progress, width, height, items, colors }) => {
      const ws = (items || []).slice(0, 6).filter((i) => i && i.label);
      if (!ws.length) return;
      const xs = spread(ws.length, width * 0.14, width * 0.86);
      const cy = height * 0.44;
      ws.forEach((w, i) => {
        const on = stagger(progress, i, 0.12);
        if (on <= 0) return;
        title(p, clean(w.label, 14), xs[i], cy, colors, 30);
        p.push();
        p.noStroke();
        p.fill(tint(p, colors.accent, 150));
        p.rect(xs[i] - 52, cy + 26, 104, 34, 6);
        p.pop();
        caption(p, clean(w.symbol, 10) || 'word', xs[i], cy + 43, colors, 19);
      });
    }),

  'sentence-parts': wide('Subject and predicate',
    'a sentence split into its subject and predicate. Use for: sentence improvement, grammar, subject-verb agreement',
    'labelA (subject), labelB (predicate)',
    ({ p, progress, width, height, params, colors }) => {
      const cy = height * 0.44;
      box(p, width * 0.3, cy, width * 0.3, height * 0.24, clean(params.labelA, 16) || 'Subject',
          colors, { lit: true });
      if (progress > 0.4) {
        box(p, width * 0.68, cy, width * 0.34, height * 0.24, clean(params.labelB, 18) || 'Predicate', colors);
      }
      caption(p, 'who or what', width * 0.3, cy + height * 0.2, colors, 20);
      caption(p, 'what it does', width * 0.68, cy + height * 0.2, colors, 20);
    }),

  'tense-timeline': wide('Tenses',
    'past, present and future marked on one line. Use for: tenses, verb forms, time expressions',
    'items (up to 3 labels: past, present, future)',
    ({ p, progress, width, height, items, colors }) => {
      const names = labels(items, 3);
      const defaults = ['Past', 'Present', 'Future'];
      const y = height * 0.5;
      wire(p, width * 0.1, y, width * 0.9 * Math.min(1, progress * 1.5), y, colors.dim, 4);
      spread(3, width * 0.22, width * 0.78).forEach((x, i) => {
        const on = stagger(progress, i, 0.16);
        if (on <= 0) return;
        junction(p, x, y, i === 1 ? colors.accent : colors.text, 22 * on);
        caption(p, names[i] || defaults[i], x, y - 44, colors, 22);
      });
    }),

  'active-passive': wide('Active and passive',
    'the same sentence with the doer and the receiver swapped. Use for: voice conversion, active and passive',
    'labelA (the doer), labelB (the receiver)',
    ({ p, progress, width, height, params, colors }) => {
      const a = clean(params.labelA, 12) || 'Doer';
      const b = clean(params.labelB, 12) || 'Receiver';
      const draw = (y: number, left: string, right: string, lit: boolean) => {
        box(p, width * 0.26, y, width * 0.26, height * 0.18, left, colors, { lit });
        arrow(p, width * 0.4, y, width * 0.6, y, colors.accent, 4);
        box(p, width * 0.74, y, width * 0.26, height * 0.18, right, colors);
      };
      draw(height * 0.3, a, b, true);
      if (progress > 0.45) draw(height * 0.7, b, a, false);
      caption(p, 'Active', width * 0.06, height * 0.3, colors, 20);
      caption(p, 'Passive', width * 0.06, height * 0.7, colors, 20);
    }),

  'para-jumble': wide('Para jumble',
    'shuffled sentences being put into their right order. Use for: para jumbles, sentence ordering, coherence',
    'items (3-5 fragments, in the CORRECT order)',
    ({ p, progress, width, height, items, colors }) => {
      const names = labels(items, 5);
      if (!names.length) return;
      const scrambled = [...names].reverse();
      const rowH = (height * 0.62) / safe(names.length);
      names.forEach((_, i) => {
        const t = Math.min(1, Math.max(0, progress * 1.6 - i * 0.1));
        const from = height * 0.18 + i * rowH;
        const toIdx = names.indexOf(scrambled[i]);
        const to = height * 0.18 + (toIdx < 0 ? i : toIdx) * rowH;
        const y = from + (to - from) * t;
        box(p, width / 2, y, width * 0.6, rowH * 0.7, scrambled[i], colors, { lit: t > 0.9 });
      });
    }),

  'word-pair': wide('Word pairs',
    'two words placed as opposites or as near-neighbours. Use for: synonyms, antonyms, one word substitution, idioms',
    'labelA and labelB (the two words), mode ("opposite" or "same")',
    ({ p, progress, width, height, params, colors }) => {
      const opposite = String(params.mode || 'opposite') === 'opposite';
      const cy = height * 0.46;
      const gap = opposite ? width * 0.26 : width * 0.13;
      const on = Math.min(1, progress * 1.6);
      bubble(p, width / 2 - gap * on, cy, 74, clean(params.labelA, 9), colors, { lit: true, size: 24 });
      bubble(p, width / 2 + gap * on, cy, 74, clean(params.labelB, 9), colors, { size: 24 });
      if (opposite) arrow(p, width / 2 - 30, cy, width / 2 + 30, cy, colors.dim, 3, 10);
      caption(p, opposite ? 'Opposites' : 'Close in meaning', width / 2, height * 0.82, colors);
    }),

  'comprehension-map': wide('Passage map',
    'a passage broken into its main idea and supporting points. Use for: reading comprehension, main idea, inference',
    'labelA (the main idea), items (2-4 supporting points)',
    ({ p, progress, width, height, params, items, colors }) => {
      const points = labels(items, 4);
      box(p, width / 2, height * 0.24, width * 0.44, height * 0.18,
          clean(params.labelA, 20) || 'Main idea', colors, { lit: true });
      const xs = spread(Math.max(1, points.length), width * 0.18, width * 0.82);
      points.forEach((n, i) => {
        const on = stagger(progress, i, 0.14);
        if (on <= 0) return;
        wire(p, width / 2, height * 0.33, xs[i], height * 0.56, colors.dim, 3);
        box(p, xs[i], height * 0.68, width * 0.2, height * 0.2, n, colors);
      });
    }),

  // =========================================================================
  // Psychology and the brain
  // =========================================================================

  'brain-regions': square('Brain regions',
    'a brain outline with regions marked. Use for: neuroscience, brain areas, what each part does',
    'items (2-5 region labels)',
    ({ p, progress, width, height, items, colors }) => {
      const names = labels(items, 5);
      const cx = width / 2;
      const cy = height * 0.48;
      const r = Math.min(width, height) * 0.3;
      p.push();
      p.stroke(colors.text);
      p.strokeWeight(4);
      p.fill(tint(p, colors.accent, 34));
      p.ellipse(cx, cy, r * 2.1, r * 1.7);
      p.noFill();
      // A few folds, which is what stops an ellipse reading as a balloon.
      for (let i = 0; i < 4; i++) {
        p.arc(cx - r * 0.5 + i * r * 0.35, cy - r * 0.2, r * 0.5, r * 0.6, Math.PI, 0);
      }
      p.pop();
      names.forEach((n, i) => {
        const on = stagger(progress, i, 0.14);
        if (on <= 0) return;
        const a = -Math.PI * 0.85 + (i / safe(names.length - 1 || 1)) * Math.PI * 1.7;
        const x = cx + Math.cos(a) * r * 0.62;
        const y = cy + Math.sin(a) * r * 0.5;
        junction(p, x, y, colors.good, 20 * on);
        caption(p, n, cx + Math.cos(a) * (r * 1.35), cy + Math.sin(a) * (r * 1.15), colors, 18);
      });
    }),

  'memory-stages': wide('Memory',
    'information passing from sensory to short then long term store. Use for: memory, forgetting, encoding and recall',
    'items (up to 3 stage labels)',
    ({ p, progress, width, height, items, colors }) => {
      const names = labels(items, 3);
      const defaults = ['Sensory', 'Short term', 'Long term'];
      const stages = [0, 1, 2].map((i) => names[i] || defaults[i]);
      const xs = rowOf(p, stages, height * 0.44, width, height * 0.26, colors, progress, 2);
      for (let i = 1; i < xs.length; i++) {
        if (stagger(progress, i - 1, 0.12) > 0.9) {
          arrow(p, xs[i - 1] + width * 0.09, height * 0.44, xs[i] - width * 0.09, height * 0.44,
                colors.accent, 4);
        }
      }
      caption(p, 'Most is lost at each step', width / 2, height * 0.8, colors);
    }),

  synapse: wide('Synapse',
    'a signal crossing the gap between two nerve cells. Use for: synapses, neurotransmitters, how neurons talk',
    'no parameters',
    ({ p, progress, width, height, colors }) => {
      const cy = height * 0.5;
      p.push();
      p.noStroke();
      p.fill(colors.accent);
      p.ellipse(width * 0.3, cy, width * 0.26, height * 0.4);
      p.fill(tint(p, colors.good, 200));
      p.ellipse(width * 0.72, cy, width * 0.26, height * 0.4);
      p.pop();
      const gapL = width * 0.44;
      const gapR = width * 0.6;
      for (let i = 0; i < 7; i++) {
        const t = Math.min(1, Math.max(0, progress * 1.6 - i * 0.07));
        const x = gapL + (gapR - gapL) * t;
        const y = cy + ((i % 3) - 1) * 26;
        p.push();
        p.noStroke();
        p.fill(colors.text);
        p.circle(x, y, 13);
        p.pop();
      }
      caption(p, 'Gap', width * 0.52, cy + height * 0.28, colors, 20);
    }),

  'reflex-arc': wide('Reflex arc',
    'a signal going in to the spine and straight back out. Use for: reflexes, the nervous system, response time',
    'labelA (the stimulus)',
    ({ p, progress, width, height, params, colors }) => {
      const cy = height * 0.5;
      const spine = width * 0.68;
      box(p, width * 0.16, cy, width * 0.18, height * 0.2, clean(params.labelA, 10) || 'Heat', colors);
      box(p, spine, cy, width * 0.14, height * 0.44, 'Spine', colors, { lit: true });
      box(p, width * 0.16, cy + height * 0.3, width * 0.18, height * 0.18, 'Muscle', colors);
      if (progress > 0.2) arrow(p, width * 0.26, cy - 14, spine - width * 0.08, cy - 14, colors.accent, 4);
      if (progress > 0.6) arrow(p, spine - width * 0.08, cy + 14, width * 0.26, cy + height * 0.3, colors.good, 4);
      caption(p, 'In', width * 0.45, cy - 44, colors, 20);
      caption(p, 'Out', width * 0.45, cy + height * 0.24, colors, 20);
    }),

  conditioning: wide('Conditioning',
    'a neutral signal paired with a stimulus until it triggers the response alone. Use for: learning, Pavlov, conditioning',
    'labelA (the signal), labelB (the response)',
    ({ p, progress, width, height, params, colors }) => {
      const a = clean(params.labelA, 10) || 'Bell';
      const b = clean(params.labelB, 12) || 'Response';
      const cy = height * 0.34;
      box(p, width * 0.24, cy, width * 0.2, height * 0.2, a, colors);
      box(p, width * 0.52, cy, width * 0.2, height * 0.2, 'Food', colors);
      box(p, width * 0.82, cy, width * 0.24, height * 0.2, b, colors, { lit: true });
      arrow(p, width * 0.36, cy, width * 0.42, cy, colors.dim, 3);
      arrow(p, width * 0.63, cy, width * 0.7, cy, colors.dim, 3);
      if (progress > 0.55) {
        const y2 = height * 0.72;
        box(p, width * 0.24, y2, width * 0.2, height * 0.2, a, colors, { lit: true });
        box(p, width * 0.82, y2, width * 0.24, height * 0.2, b, colors, { lit: true });
        arrow(p, width * 0.36, y2, width * 0.68, y2, colors.accent, 5);
        caption(p, 'now on its own', width * 0.52, y2 - 34, colors, 20);
      }
    }),

  'bias-scale': wide('Bias',
    'a judgement pulled off centre by a bias. Use for: behavioural economics, cognitive bias, anchoring, decision making',
    'ratio (-1 to 1, which way the pull goes), labelA (the bias)',
    ({ p, progress, width, height, params, colors }) => {
      const pull = num(params.ratio, 0.6, -1, 1) * Math.min(1, progress * 1.5);
      const y = height * 0.5;
      wire(p, width * 0.12, y, width * 0.88, y, colors.dim, 4);
      setDash(p, true);
      wire(p, width / 2, y - 60, width / 2, y + 60, colors.dim, 2);
      setDash(p, false);
      caption(p, 'Truth', width / 2, y + 84, colors, 20);
      const x = width / 2 + pull * width * 0.32;
      junction(p, x, y, colors.accent, 30);
      caption(p, clean(params.labelA, 18) || 'Bias', x, y - 52, colors, 22);
      if (Math.abs(pull) > 0.05) arrow(p, width / 2, y - 22, x, y - 22, colors.accent, 3, 11);
    }),

  'stress-curve': wide('Pressure and performance',
    'performance rising with pressure then falling away. Use for: stress, arousal, motivation, burnout',
    'no parameters',
    ({ p, progress, width, height, colors }) => {
      const plot = axes(p, width, height, colors, { x: 'Pressure', y: 'Performance' });
      curve(p, plot, (t) => 0.15 + Math.sin(t * Math.PI) * 0.72, colors.accent, progress);
      if (progress > 0.6) {
        junction(p, plot.x(0.5), plot.y(0.87), colors.good, 18);
        caption(p, 'Best here', plot.x(0.5), plot.y(0.87) - 30, colors, 20);
      }
    }),

  'sleep-cycle': wide('Sleep cycle',
    'depth of sleep rising and falling through the night. Use for: sleep, circadian rhythm, REM',
    'count (3-5 cycles)',
    ({ p, progress, width, height, params, colors }) => {
      const n = num(params.count, 4, 3, 5);
      const plot = axes(p, width, height, colors, { x: 'Hours', y: 'Depth' });
      curve(p, plot, (t) => 0.5 + Math.cos(t * Math.PI * 2 * n) * 0.38, colors.accent, progress);
      caption(p, 'REM near each peak', width / 2, height * 0.94, colors, 20);
    }),

  // =========================================================================
  // Mathematics
  // =========================================================================

  matrix: square('Matrix',
    'a grid of numbers with rows and columns marked. Use for: matrices, determinants, linear algebra',
    'count (2-4, the size), items (cell values in order)',
    ({ p, progress, width, height, params, items, colors }) => {
      const n = Math.round(num(params.count, 3, 2, 4));
      const vs = values(items, 16);
      const s = Math.min(width, height) * (n <= 2 ? 0.24 : 0.19);
      const cx = width / 2;
      const cy = height * 0.48;
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          const i = r * n + c;
          const on = stagger(progress, i, 0.05, 3);
          if (on <= 0) continue;
          const x = cx + (c - (n - 1) / 2) * s;
          const y = cy + (r - (n - 1) / 2) * s;
          title(p, vs[i] ? String(vs[i].value) : String((i % 9) + 1), x, y, colors, s * 0.32);
        }
      }
      const w = s * n * 0.62;
      const h = s * n * 0.58;
      p.push();
      p.noFill();
      p.stroke(colors.accent);
      p.strokeWeight(5);
      p.line(cx - w, cy - h, cx - w - 14, cy - h);
      p.line(cx - w - 14, cy - h, cx - w - 14, cy + h);
      p.line(cx - w - 14, cy + h, cx - w, cy + h);
      p.line(cx + w, cy - h, cx + w + 14, cy - h);
      p.line(cx + w + 14, cy - h, cx + w + 14, cy + h);
      p.line(cx + w + 14, cy + h, cx + w, cy + h);
      p.pop();
    }),

  'vector-add': square('Adding vectors',
    'two arrows joined head to tail with their resultant. Use for: vectors, resultant force, components',
    'angle (10-170, between them), labelA, labelB',
    ({ p, progress, width, height, params, colors }) => {
      const deg = num(params.angle, 60, 10, 170);
      const a = (deg * Math.PI) / 180;
      const ox = width * 0.28;
      const oy = height * 0.72;
      const len = Math.min(width, height) * 0.34;
      const v1 = { x: len, y: 0 };
      const v2 = { x: Math.cos(-a) * len * 0.8, y: Math.sin(-a) * len * 0.8 };
      const t = Math.min(1, progress * 1.6);
      arrow(p, ox, oy, ox + v1.x * t, oy + v1.y * t, colors.accent, 5);
      if (t > 0.5) {
        arrow(p, ox + v1.x, oy + v1.y, ox + v1.x + v2.x, oy + v1.y + v2.y, colors.good, 5);
      }
      if (progress > 0.7) {
        arrow(p, ox, oy, ox + v1.x + v2.x, oy + v1.y + v2.y, colors.text, 6);
        caption(p, 'Resultant', ox + (v1.x + v2.x) * 0.5 - 40, oy + (v1.y + v2.y) * 0.5 - 30, colors, 20);
      }
      caption(p, clean(params.labelA, 6) || 'a', ox + v1.x * 0.5, oy + 30, colors, 22);
      caption(p, clean(params.labelB, 6) || 'b', ox + v1.x + v2.x * 0.5 + 30, oy + v2.y * 0.5, colors, 22);
    }),

  'area-under': wide('Area under a curve',
    'a curve with the area beneath it filled in strips. Use for: integration, area under a graph, accumulated total',
    'count (4-12 strips)',
    ({ p, progress, width, height, params, colors }) => {
      const n = Math.round(num(params.count, 8, 4, 12));
      const plot = axes(p, width, height, colors, { x: 'x', y: 'y' });
      const fn = (t: number) => 0.25 + t * t * 0.6;
      for (let i = 0; i < n; i++) {
        const on = stagger(progress, i, 0.06, 2.4);
        if (on <= 0) continue;
        const t = i / safe(n);
        const w = (plot.right - plot.left) / safe(n);
        const h = (plot.bottom - plot.y(fn(t))) * on;
        p.push();
        p.noStroke();
        p.fill(tint(p, colors.accent, 110));
        p.rect(plot.x(t), plot.bottom - h, w - 2, h);
        p.pop();
      }
      curve(p, plot, fn, colors.text, 1);
    }),

  'slope-tangent': wide('Slope of a curve',
    'a tangent touching a curve at one point. Use for: differentiation, gradient, rate of change',
    'ratio (0.1-0.9, where the tangent sits)',
    ({ p, progress, width, height, params, colors }) => {
      const at = num(params.ratio, 0.6, 0.1, 0.9);
      const plot = axes(p, width, height, colors, { x: 'x', y: 'y' });
      const fn = (t: number) => 0.2 + t * t * 0.7;
      curve(p, plot, fn, colors.accent, 1);
      const t = Math.min(1, progress * 1.6);
      const px = plot.x(at);
      const py = plot.y(fn(at));
      const slope = (fn(at + 0.01) - fn(at - 0.01)) / 0.02;
      const dx = (plot.right - plot.left) * 0.16 * t;
      const dy = slope * (plot.bottom - plot.top) * 0.16 * t;
      wire(p, px - dx, py + dy, px + dx, py - dy, colors.good, 4);
      junction(p, px, py, colors.text, 18);
      caption(p, 'Tangent', px + 60, py - 40, colors, 20);
    }),

  'probability-tree': wide('Probability tree',
    'branching outcomes with a probability on each branch. Use for: probability, conditional events, tree diagrams',
    'items (2-4 outcome labels), ratio (0-1, chance of the first branch)',
    ({ p, progress, width, height, params, items, colors }) => {
      const names = labels(items, 4);
      const first = num(params.ratio, 0.5, 0, 1);
      const ox = width * 0.14;
      const cy = height * 0.5;
      junction(p, ox, cy, colors.text, 18);
      const tips = [cy - height * 0.24, cy + height * 0.24];
      tips.forEach((y, i) => {
        const on = stagger(progress, i, 0.14);
        if (on <= 0) return;
        const x = width * 0.46;
        wire(p, ox, cy, ox + (x - ox) * on, cy + (y - cy) * on, colors.accent, 4);
        caption(p, (i === 0 ? first : 1 - first).toFixed(2), (ox + x) / 2, (cy + y) / 2 - 20, colors, 19);
        box(p, x + width * 0.1, y, width * 0.2, height * 0.16, names[i] || (i ? 'No' : 'Yes'), colors);
        [-1, 1].forEach((s, k) => {
          const on2 = stagger(progress, 2 + i * 2 + k, 0.1);
          if (on2 <= 0) return;
          const y2 = y + s * height * 0.12;
          wire(p, x + width * 0.2, y, x + width * 0.2 + width * 0.12 * on2, y + (y2 - y) * on2,
               colors.dim, 3);
          box(p, x + width * 0.4, y2, width * 0.16, height * 0.12,
              names[2 + k] || (k ? 'No' : 'Yes'), colors);
        });
      });
    }),

  'number-grid': square('Number grid',
    'a grid of numbers with some picked out. Use for: multiples, primes, patterns, divisibility',
    'count (4-10 across), ratio (highlight every nth)',
    ({ p, progress, width, height, params, colors }) => {
      const n = Math.round(num(params.count, 6, 4, 10));
      const every = Math.round(num(params.ratio, 3, 2, 9));
      const s = Math.min(width, height) * 0.82 / safe(n);
      const ox = width / 2 - (s * n) / 2;
      const oy = height * 0.48 - (s * n) / 2;
      for (let i = 0; i < n * n; i++) {
        const on = stagger(progress, i, 0.02, 3);
        if (on <= 0) continue;
        const v = i + 1;
        const hit = v % every === 0;
        const x = ox + (i % n) * s;
        const y = oy + Math.floor(i / n) * s;
        p.push();
        p.stroke(colors.dim);
        p.strokeWeight(2);
        p.fill(tint(p, hit ? colors.accent : colors.bg, hit ? 160 : 255));
        p.rect(x, y, s - 3, s - 3, 4);
        p.noStroke();
        p.fill(colors.text);
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(s * 0.34);
        p.text(String(v), x + s / 2 - 1, y + s / 2 - 1);
        p.pop();
      }
    }),

  logarithm: wide('Logarithm',
    'a log curve flattening as the number grows. Use for: logarithms, orders of magnitude, decibels, pH',
    'labelA (x axis), labelB (y axis)',
    ({ p, progress, width, height, params, colors }) => {
      const plot = axes(p, width, height, colors, {
        x: clean(params.labelA, 14) || 'Value', y: clean(params.labelB, 10) || 'log',
      });
      curve(p, plot, (t) => Math.log10(1 + t * 99) / 2, colors.accent, progress);
      caption(p, 'Each step is ten times the last', width / 2, height * 0.93, colors, 20);
    }),

  'complex-plane': square('Complex plane',
    'a point plotted on real and imaginary axes. Use for: complex numbers, Argand diagram, phasors',
    'ratio (real part), amplitude (imaginary part)',
    ({ p, progress, width, height, params, colors }) => {
      const re = num(params.ratio, 0.6, -1, 1);
      const im = num(params.amplitude, 0.5, -1, 1);
      const cx = width / 2;
      const cy = height * 0.48;
      const r = Math.min(width, height) * 0.34;
      p.push();
      p.stroke(colors.dim);
      p.strokeWeight(3);
      p.line(cx - r, cy, cx + r, cy);
      p.line(cx, cy - r, cx, cy + r);
      p.pop();
      caption(p, 'Re', cx + r - 20, cy + 26, colors, 20);
      caption(p, 'Im', cx + 24, cy - r + 16, colors, 20);
      const t = Math.min(1, progress * 1.6);
      const x = cx + re * r * 0.8 * t;
      const y = cy - im * r * 0.8 * t;
      arrow(p, cx, cy, x, y, colors.accent, 5);
      junction(p, x, y, colors.text, 16);
      setDash(p, true);
      wire(p, x, y, x, cy, colors.dim, 2);
      wire(p, x, y, cx, y, colors.dim, 2);
      setDash(p, false);
    }),

  // =========================================================================
  // Statistics
  // =========================================================================

  'normal-curve': wide('Normal distribution',
    'a bell curve with its standard deviations marked. Use for: statistics, normal distribution, spread, averages, sampling',
    'ratio (0.5-2, how wide it is)',
    ({ p, progress, width, height, params, colors }) => {
      const spreadW = num(params.ratio, 1, 0.5, 2);
      const plot = axes(p, width, height, colors, {});
      const fn = (t: number) => Math.exp(-Math.pow((t - 0.5) * 6 / spreadW, 2)) * 0.85;
      curve(p, plot, fn, colors.accent, progress);
      if (progress > 0.6) {
        [-1, 1].forEach((s) => {
          const t = 0.5 + s * spreadW / 6;
          if (t > 0 && t < 1) {
            setDash(p, true);
            wire(p, plot.x(t), plot.bottom, plot.x(t), plot.y(fn(t)), colors.dim, 2);
            setDash(p, false);
            caption(p, s < 0 ? '-1σ' : '+1σ', plot.x(t), plot.bottom + 26, colors, 19);
          }
        });
      }
    }),

  'box-plot': wide('Box plot',
    'a box and whiskers showing spread and median. Use for: median, quartiles, spread, outliers',
    'items (up to 3 groups, each with a label and a value)',
    ({ p, progress, width, height, items, colors }) => {
      const groups = values(items, 3);
      const rows = groups.length || 1;
      const gap = (height * 0.6) / safe(rows);
      for (let i = 0; i < rows; i++) {
        const on = stagger(progress, i, 0.16);
        if (on <= 0) continue;
        const y = height * 0.26 + i * gap;
        const mid = width * (0.4 + (i * 0.06));
        const w = width * 0.2 * on;
        p.push();
        p.stroke(colors.dim);
        p.strokeWeight(3);
        p.line(mid - w * 1.6, y, mid + w * 1.6, y);
        p.line(mid - w * 1.6, y - 16, mid - w * 1.6, y + 16);
        p.line(mid + w * 1.6, y - 16, mid + w * 1.6, y + 16);
        p.stroke(colors.accent);
        p.strokeWeight(4);
        p.fill(tint(p, colors.accent, 60));
        p.rect(mid - w, y - 26, w * 2, 52, 4);
        p.stroke(colors.text);
        p.line(mid, y - 26, mid, y + 26);
        p.pop();
        caption(p, groups[i] ? groups[i].label : 'Group', width * 0.14, y, colors, 20);
      }
    }),

  'regression-line': wide('Line of best fit',
    'points with a straight line drawn through them. Use for: correlation, regression, trends, prediction',
    'ratio (-1 to 1, the trend)',
    ({ p, progress, width, height, params, colors }) => {
      const corr = num(params.ratio, 0.75, -1, 1);
      const plot = axes(p, width, height, colors, { x: 'x', y: 'y' });
      for (let i = 0; i < 10; i++) {
        const on = stagger(progress, i, 0.05, 2.6);
        if (on <= 0) continue;
        const t = (i + 0.5) / 10;
        const noise = (((i * 53) % 17) / 17 - 0.5) * 0.26;
        junction(p, plot.x(t), plot.y(Math.min(1, Math.max(0, 0.5 + corr * (t - 0.5) + noise))),
                 colors.accent, 16 * on);
      }
      if (progress > 0.65) {
        wire(p, plot.x(0.02), plot.y(0.5 - corr * 0.48), plot.x(0.98), plot.y(0.5 + corr * 0.48),
             colors.good, 4);
      }
    }),

  'sampling': wide('Sampling',
    'a small sample taken from a big population. Use for: sampling, bias, surveys, representativeness',
    'ratio (0.05-0.4, sample size)',
    ({ p, progress, width, height, params, colors }) => {
      const frac = num(params.ratio, 0.15, 0.05, 0.4);
      const cx = width * 0.3;
      const cy = height * 0.5;
      const r = Math.min(width, height) * 0.3;
      p.push();
      p.noFill();
      p.stroke(colors.dim);
      p.strokeWeight(4);
      p.circle(cx, cy, r * 2);
      p.pop();
      for (let i = 0; i < 60; i++) {
        const a = (i * 2.39996);
        const rr = Math.sqrt((i + 0.5) / 60) * r * 0.9;
        const x = cx + Math.cos(a) * rr;
        const y = cy + Math.sin(a) * rr;
        const picked = i % Math.max(2, Math.round(1 / safe(frac))) === 0;
        p.push();
        p.noStroke();
        const lit = picked && progress > 0.4;
        p.fill(tint(p, lit ? colors.accent : colors.dim, lit ? 255 : 120));
        p.circle(x, y, picked ? 14 : 9);
        p.pop();
      }
      caption(p, 'Population', cx, cy + r + 34, colors);
      if (progress > 0.6) {
        arrow(p, cx + r + 10, cy, width * 0.72, cy, colors.accent, 4);
        bubble(p, width * 0.84, cy, r * 0.4, '', colors, { lit: true });
        caption(p, 'Sample', width * 0.84, cy + r * 0.4 + 30, colors);
      }
    }),

  // =========================================================================
  // Economics and money
  // =========================================================================

  'supply-demand': wide('Supply and demand',
    'two lines crossing at the market price. Use for: supply, demand, equilibrium price, shortages',
    'ratio (0.2-0.8, where they cross)',
    ({ p, progress, width, height, params, colors }) => {
      const at = num(params.ratio, 0.5, 0.2, 0.8);
      const plot = axes(p, width, height, colors, { x: 'Quantity', y: 'Price' });
      curve(p, plot, (t) => 0.9 - t * 0.75, '#ff6b6b', progress);
      curve(p, plot, (t) => 0.15 + t * 0.75, colors.accent, progress);
      if (progress > 0.7) {
        junction(p, plot.x(at), plot.y(0.15 + at * 0.75), colors.good, 20);
        caption(p, 'Equilibrium', plot.x(at) + 70, plot.y(0.15 + at * 0.75) - 20, colors, 20);
      }
      caption(p, 'Demand', plot.x(0.12), plot.y(0.82), colors, 19);
      caption(p, 'Supply', plot.x(0.12), plot.y(0.2), colors, 19);
    }),

  inflation: wide('Inflation',
    'the same basket costing more over time. Use for: inflation, purchasing power, cost of living',
    'items (2-4 years, each with a label and a value)',
    ({ p, progress, width, height, items, colors }) => {
      const vs = values(items, 4);
      const plot = axes(p, width, height, colors, { x: 'Year', y: 'Cost' });
      if (vs.length) bars(p, plot, vs, colors, progress);
      else bars(p, plot, [
        { label: 'Then', value: 40 }, { label: 'Now', value: 100 },
      ], colors, progress);
      caption(p, 'Same basket, more money', width / 2, height * 0.94, colors, 20);
    }),

  'business-cycle': wide('Business cycle',
    'output rising and falling around a trend line. Use for: recession, boom, growth cycles',
    'count (1-3 cycles)',
    ({ p, progress, width, height, params, colors }) => {
      const n = num(params.count, 2, 1, 3);
      const plot = axes(p, width, height, colors, { x: 'Time', y: 'Output' });
      setDash(p, true);
      wire(p, plot.left, plot.y(0.4), plot.right, plot.y(0.72), colors.dim, 3);
      setDash(p, false);
      curve(p, plot, (t) => 0.4 + t * 0.32 + Math.sin(t * Math.PI * 2 * n) * 0.18, colors.accent, progress);
      caption(p, 'Trend', plot.right - 60, plot.y(0.76), colors, 19);
    }),

  'compound-growth': wide('Compound growth',
    'simple and compound interest pulling apart over time. Use for: compound interest, growth, why time matters',
    'ratio (0.05-0.3, the rate)',
    ({ p, progress, width, height, params, colors }) => {
      const rate = num(params.ratio, 0.15, 0.05, 0.3);
      const plot = axes(p, width, height, colors, { x: 'Years', y: 'Amount' });
      curve(p, plot, (t) => 0.15 + t * rate * 3, colors.dim, progress);
      curve(p, plot, (t) => 0.15 * Math.pow(1 + rate, t * 10) * 0.9, colors.accent, progress);
      caption(p, 'Compound', plot.x(0.78), plot.y(0.86), colors, 19);
      caption(p, 'Simple', plot.x(0.78), plot.y(0.4), colors, 19);
    }),

  'emi-schedule': wide('Instalments',
    'each payment splitting into interest and principal. Use for: EMI, loans, instalments, repayment',
    'count (3-6 payments)',
    ({ p, progress, width, height, params, colors }) => {
      const n = Math.round(num(params.count, 5, 3, 6));
      const plot = axes(p, width, height, colors, { x: 'Payment', y: '' });
      const slot = (plot.right - plot.left) / safe(n);
      for (let i = 0; i < n; i++) {
        const on = stagger(progress, i, 0.12);
        if (on <= 0) continue;
        const full = (plot.bottom - plot.top) * 0.7 * on;
        const interest = full * (1 - i / safe(n)) * 0.6;
        const x = plot.left + i * slot + slot * 0.2;
        const w = slot * 0.6;
        p.push();
        p.noStroke();
        p.fill(tint(p, '#ff6b6b', 190));
        p.rect(x, plot.bottom - interest, w, interest);
        p.fill(tint(p, colors.accent, 210));
        p.rect(x, plot.bottom - full, w, full - interest);
        p.pop();
      }
      caption(p, 'Interest shrinks, principal grows', width / 2, height * 0.94, colors, 20);
    }),

  // =========================================================================
  // Computing and digital electronics
  // =========================================================================

  'logic-gate': wide('Logic gate',
    'a gate with its inputs and output. Use for: logic gates, boolean algebra, digital circuits',
    'mode ("and", "or", "not", "nand", "xor"), labelA/labelB (inputs)',
    ({ p, progress, width, height, params, colors }) => {
      const kind = String(params.mode || 'and').toLowerCase();
      const cx = width * 0.52;
      const cy = height * 0.5;
      const w = Math.min(width * 0.2, height * 0.4);
      p.push();
      p.stroke(colors.accent);
      p.strokeWeight(5);
      p.fill(colors.bg);
      if (kind === 'or' || kind === 'xor') {
        p.beginShape();
        for (let t = 0; t <= 1; t += 0.05) {
          p.vertex(cx - w / 2 + Math.sin(t * Math.PI) * w * 0.35, cy - w + t * w * 2);
        }
        for (let t = 1; t >= 0; t -= 0.05) {
          p.vertex(cx + w / 2 + Math.sin(t * Math.PI) * w * 0.2 - w * 0.2, cy - w + t * w * 2);
        }
        p.endShape();
      } else {
        p.rect(cx - w / 2, cy - w, w, w * 2, 0, w, w, 0);
      }
      p.pop();
      title(p, kind.toUpperCase(), cx, cy, colors, 26);
      if (kind === 'not' || kind === 'nand') junction(p, cx + w / 2 + 12, cy, colors.accent, 18);
      wire(p, width * 0.1, cy - w * 0.45, cx - w / 2, cy - w * 0.45, colors.text);
      if (kind !== 'not') wire(p, width * 0.1, cy + w * 0.45, cx - w / 2, cy + w * 0.45, colors.text);
      wire(p, cx + w / 2 + 24, cy, width * 0.92, cy, colors.text);
      caption(p, clean(params.labelA, 4) || 'A', width * 0.07, cy - w * 0.45, colors, 22);
      if (kind !== 'not') caption(p, clean(params.labelB, 4) || 'B', width * 0.07, cy + w * 0.45, colors, 22);
    }),

  'truth-table': square('Truth table',
    'inputs and their outputs in a table. Use for: logic gates, boolean algebra, digital design',
    'items (up to 4 rows; label is the input pair, value is the output)',
    ({ p, progress, width, height, items, colors }) => {
      const rows = (items || []).slice(0, 4).filter((i) => i && i.label);
      const list = rows.length ? rows : [
        { label: '0 0', value: 0 }, { label: '0 1', value: 0 },
        { label: '1 0', value: 0 }, { label: '1 1', value: 1 },
      ];
      const w = Math.min(width * 0.6, height * 0.7);
      const rowH = (height * 0.6) / safe(list.length + 1);
      const ox = width / 2 - w / 2;
      const oy = height * 0.22;
      caption(p, 'In', ox + w * 0.25, oy, colors, 22);
      caption(p, 'Out', ox + w * 0.75, oy, colors, 22);
      list.forEach((r, i) => {
        const on = stagger(progress, i, 0.14);
        if (on <= 0) return;
        const y = oy + (i + 1) * rowH;
        p.push();
        p.noFill();
        p.stroke(colors.dim);
        p.strokeWeight(2);
        p.rect(ox, y - rowH * 0.4, w, rowH * 0.8, 4);
        p.line(ox + w * 0.5, y - rowH * 0.4, ox + w * 0.5, y + rowH * 0.4);
        p.pop();
        title(p, clean(r.label, 6), ox + w * 0.25, y, colors, 24);
        title(p, String(Number(r.value) ? 1 : 0), ox + w * 0.75, y, colors, 24);
      });
    }),

  'binary-number': wide('Binary',
    'a number written as bits with their place values. Use for: binary, number systems, bits and bytes',
    'count (4-16 bits; widened automatically if the value needs more), ratio (the value, 0-65535)',
    ({ p, progress, width, height, params, colors }) => {
      // The VALUE is what the caption prints, so it decides how many bits are
      // shown - not the other way round. Clamping the value to fit a fixed
      // eight bits printed a number nobody asked for.
      const value = Math.round(num(params.ratio, 42, 0, 65535));
      const needed = Math.max(1, Math.ceil(Math.log2(value + 1)));
      const bits = Math.min(16, Math.max(Math.round(num(params.count, 8, 4, 16)), needed));
      const s = Math.min(width * 0.82 / safe(bits), height * 0.3);
      const ox = width / 2 - (s * bits) / 2;
      const cy = height * 0.44;
      for (let i = 0; i < bits; i++) {
        const on = stagger(progress, i, 0.08);
        if (on <= 0) continue;
        const place = Math.pow(2, bits - 1 - i);
        const bit = Math.floor(value / place) % 2;
        const x = ox + i * s;
        p.push();
        p.stroke(bit ? colors.accent : colors.dim);
        p.strokeWeight(4);
        p.fill(tint(p, bit ? colors.accent : colors.bg, bit ? 90 : 255));
        p.rect(x + 3, cy - s / 2, s - 6, s, 6);
        p.pop();
        title(p, String(bit), x + s / 2, cy, colors, s * 0.44);
        caption(p, String(place), x + s / 2, cy + s * 0.78, colors, 17);
      }
      title(p, '= ' + value, width / 2, height * 0.86, colors, 32);
    }),

  'network-topology': square('Network topology',
    'devices wired as a star, ring or bus. Use for: networking, topology, LAN layout',
    'mode ("star", "ring" or "bus"), count (3-6 nodes)',
    ({ p, progress, width, height, params, colors }) => {
      const mode = String(params.mode || 'star');
      const n = Math.round(num(params.count, 5, 3, 6));
      const cx = width / 2;
      const cy = height * 0.48;
      const r = Math.min(width, height) * 0.3;
      if (mode === 'bus') {
        wire(p, width * 0.1, cy, width * 0.9, cy, colors.dim, 5);
        spread(n, width * 0.2, width * 0.8).forEach((x, i) => {
          const on = stagger(progress, i, 0.1);
          if (on <= 0) return;
          wire(p, x, cy, x, cy - r * 0.5, colors.text, 3);
          bubble(p, x, cy - r * 0.62, 24 * on, '', colors);
        });
      } else {
        const pts = new Array(n).fill(0).map((_, i) => {
          const a = (i / safe(n)) * Math.PI * 2 - Math.PI / 2;
          return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
        });
        pts.forEach((q, i) => {
          const on = stagger(progress, i, 0.1);
          if (on <= 0) return;
          if (mode === 'ring') wire(p, q.x, q.y, pts[(i + 1) % n].x, pts[(i + 1) % n].y, colors.dim, 4);
          else wire(p, cx, cy, q.x, q.y, colors.dim, 4);
          bubble(p, q.x, q.y, 26 * on, '', colors);
        });
        if (mode === 'star') bubble(p, cx, cy, 34, 'Hub', colors, { lit: true, size: 18 });
      }
      caption(p, mode, width / 2, height * 0.92, colors);
    }),

  'layer-stack': square('Layer stack',
    'layers stacked with the lowest at the bottom. Use for: OSI layers, protocol stacks, memory hierarchy, any layered model',
    'items (3-7 layers, top first)',
    ({ p, progress, width, height, items, colors }) => {
      const names = labels(items, 7);
      if (!names.length) return;
      const h = (height * 0.66) / safe(names.length);
      names.forEach((n, i) => {
        const on = stagger(progress, names.length - 1 - i, 0.1);
        if (on <= 0) return;
        const y = height * 0.18 + i * h;
        p.push();
        p.stroke(colors.text);
        p.strokeWeight(3);
        p.fill(tint(p, colors.accent, 200 - i * 22));
        p.rect(width * 0.2, y, width * 0.6 * on, h - 6, 5);
        p.pop();
        caption(p, n, width * 0.5, y + h / 2 - 3, colors, 20);
      });
    }),

  'cpu-cycle': square('Fetch and execute',
    'the fetch, decode, execute loop going round. Use for: CPU, instruction cycle, how a processor works',
    'no parameters',
    ({ p, progress, width, height, colors }) => {
      const steps = ['Fetch', 'Decode', 'Execute', 'Store'];
      const cx = width / 2;
      const cy = height * 0.48;
      const r = Math.min(width, height) * 0.3;
      steps.forEach((s, i) => {
        const a = (i / 4) * Math.PI * 2 - Math.PI / 2;
        const next = ((i + 1) / 4) * Math.PI * 2 - Math.PI / 2;
        const on = stagger(progress, i, 0.16);
        if (on <= 0) return;
        arcArrow(p, cx, cy, r, a + 0.3, next - 0.3, tint(p, colors.accent, 190), 4);
        bubble(p, cx + Math.cos(a) * r, cy + Math.sin(a) * r, 44 * on, '', colors, { lit: i === 0 });
        caption(p, s, cx + Math.cos(a) * r, cy + Math.sin(a) * r, colors, 19);
      });
    }),

  'sorting-steps': wide('Sorting',
    'bars being swapped into order. Use for: sorting algorithms, ordering, arranging by size',
    'count (4-8 bars)',
    ({ p, progress, width, height, params, colors }) => {
      const n = Math.round(num(params.count, 6, 4, 8));
      const start = new Array(n).fill(0).map((_, i) => ((i * 37) % n) + 1);
      const sorted = [...start].sort((a, b) => a - b);
      const t = Math.min(1, progress * 1.3);
      const plot = axes(p, width, height, colors, {});
      const slot = (plot.right - plot.left) / safe(n);
      for (let i = 0; i < n; i++) {
        const v = start[i] + (sorted[i] - start[i]) * t;
        const h = (v / safe(n)) * (plot.bottom - plot.top) * 0.9;
        p.push();
        p.noStroke();
        p.fill(tint(p, t > 0.95 ? colors.good : colors.accent, 210));
        p.rect(plot.left + i * slot + slot * 0.15, plot.bottom - h, slot * 0.7, h, 5, 5, 0, 0);
        p.pop();
      }
      caption(p, t > 0.95 ? 'Sorted' : 'Sorting…', width / 2, height * 0.94, colors);
    }),

  'binary-search': wide('Binary search',
    'a range halving until one item is left. Use for: searching, halving, divide and conquer',
    'count (8-16 items)',
    ({ p, progress, width, height, params, colors }) => {
      const n = Math.round(num(params.count, 12, 8, 16));
      const step = Math.floor(progress * 3.2);
      let lo = 0;
      let hi = n - 1;
      for (let s = 0; s < step; s++) {
        const mid = Math.floor((lo + hi) / 2);
        if (s % 2 === 0) lo = mid + 1; else hi = mid;
      }
      const s = Math.min(width * 0.86 / safe(n), height * 0.3);
      const ox = width / 2 - (s * n) / 2;
      const cy = height * 0.48;
      for (let i = 0; i < n; i++) {
        const live = i >= lo && i <= hi;
        p.push();
        p.stroke(live ? colors.accent : colors.dim);
        p.strokeWeight(live ? 4 : 2);
        p.fill(tint(p, live ? colors.accent : colors.bg, live ? 80 : 255));
        p.rect(ox + i * s + 2, cy - s / 2, s - 4, s, 5);
        p.pop();
      }
      caption(p, (hi - lo + 1) + ' left', width / 2, cy + s, colors, 22);
    }),

  'packet-route': wide('Packet routing',
    'a packet hopping between nodes to reach its destination. Use for: networks, the internet, routing, protocols',
    'count (3-5 hops)',
    ({ p, progress, width, height, params, colors }) => {
      const n = Math.round(num(params.count, 4, 3, 5));
      const xs = spread(n, width * 0.14, width * 0.86);
      const ys = xs.map((_, i) => height * (i % 2 === 0 ? 0.36 : 0.64));
      for (let i = 0; i < n - 1; i++) wire(p, xs[i], ys[i], xs[i + 1], ys[i + 1], colors.dim, 3);
      xs.forEach((x, i) => bubble(p, x, ys[i], 30, '', colors, { lit: i === 0 || i === n - 1 }));
      const t = progress * (n - 1);
      const seg = Math.min(n - 2, Math.floor(t));
      const f = t - seg;
      p.push();
      p.noStroke();
      p.fill(colors.accent);
      p.circle(xs[seg] + (xs[seg + 1] - xs[seg]) * f, ys[seg] + (ys[seg + 1] - ys[seg]) * f, 22);
      p.pop();
      caption(p, 'Source', xs[0], ys[0] + 54, colors, 19);
      caption(p, 'Destination', xs[n - 1], ys[n - 1] + 54, colors, 19);
    }),

  'database-table': wide('Database table',
    'rows and columns of a table with a key column marked. Use for: databases, tables, records, keys',
    'items (2-4 column names)',
    ({ p, progress, width, height, items, colors }) => {
      const cols = labels(items, 4);
      const names = cols.length ? cols : ['id', 'name', 'value'];
      const w = width * 0.76;
      const ox = width * 0.12;
      const colW = w / safe(names.length);
      const rowH = Math.min(52, height * 0.13);
      const oy = height * 0.24;
      names.forEach((n, i) => {
        p.push();
        p.noStroke();
        p.fill(tint(p, colors.accent, i === 0 ? 200 : 120));
        p.rect(ox + i * colW, oy, colW - 3, rowH, 5, 5, 0, 0);
        p.pop();
        caption(p, n, ox + i * colW + colW / 2, oy + rowH / 2, colors, 19);
      });
      for (let r = 0; r < 3; r++) {
        const on = stagger(progress, r, 0.16);
        if (on <= 0) continue;
        names.forEach((_, i) => {
          p.push();
          p.noFill();
          p.stroke(colors.dim);
          p.strokeWeight(2);
          p.rect(ox + i * colW, oy + rowH * (r + 1) + 3, colW - 3, rowH - 3);
          p.pop();
        });
      }
      caption(p, 'Key', ox + colW / 2, oy - 24, colors, 18);
    }),

  // =========================================================================
  // Astronomy and space
  // =========================================================================

  'star-lifecycle': wide('Life of a star',
    'a star passing through its stages. Use for: stellar evolution, supernovae, white dwarfs',
    'items (3-5 stage labels)',
    ({ p, progress, width, height, items, colors }) => {
      const names = labels(items, 5);
      const stages = names.length ? names : ['Nebula', 'Star', 'Giant', 'Remnant'];
      const xs = spread(stages.length, width * 0.14, width * 0.86);
      const cy = height * 0.46;
      stages.forEach((s, i) => {
        const on = stagger(progress, i, 0.16);
        if (on <= 0) return;
        const r = (18 + i * 12) * on;
        p.push();
        p.noStroke();
        p.fill(tint(p, i < 2 ? colors.accent : '#ff8c42', 220));
        p.circle(xs[i], cy, r * 2);
        p.pop();
        caption(p, s, xs[i], cy + 66, colors, 19);
        if (i > 0 && stagger(progress, i - 1, 0.16) > 0.9) {
          arrow(p, xs[i - 1] + 40, cy, xs[i] - 40, cy, colors.dim, 3, 11);
        }
      });
    }),

  eclipse: wide('Eclipse',
    'three bodies lining up with a shadow cast. Use for: eclipses, shadows, alignment',
    'mode ("solar" or "lunar")',
    ({ p, progress, width, height, params, colors }) => {
      const solar = String(params.mode || 'solar') === 'solar';
      const cy = height * 0.5;
      const t = Math.min(1, progress * 1.4);
      p.push();
      p.noStroke();
      p.fill('#ffd400');
      p.circle(width * 0.14, cy, 84);
      p.fill(tint(p, colors.dim, 220));
      p.circle(width * 0.5, cy, solar ? 40 : 62);
      p.fill(tint(p, colors.accent, 200));
      p.circle(width * 0.86, cy, solar ? 62 : 40);
      // The shadow cone, drawn only once the bodies have lined up.
      p.fill(tint(p, '#000000', 150 * t));
      p.triangle(width * 0.5, cy - 22, width * 0.5, cy + 22, width * 0.86, cy);
      p.pop();
      caption(p, solar ? 'Moon blocks the Sun' : 'Earth shadows the Moon', width / 2, height * 0.86, colors);
    }),

  'rocket-stages': square('Rocket stages',
    'stages dropping away as a rocket climbs. Use for: rockets, staging, escape velocity, launches',
    'count (2-3 stages)',
    ({ p, progress, width, height, params, colors }) => {
      const n = Math.round(num(params.count, 3, 2, 3));
      const cx = width / 2;
      const ground = height * 0.9;
      const climb = progress * height * 0.62;
      const y = ground - climb;
      const dropped = Math.min(n - 1, Math.floor(progress * n));
      for (let i = 0; i < n; i++) {
        if (i < dropped) {
          p.push();
          p.noStroke();
          p.fill(tint(p, colors.dim, 130));
          p.rect(cx - 20 + i * 34, ground - 40 - i * 20, 30, 54, 5);
          p.pop();
          continue;
        }
        p.push();
        p.noStroke();
        const top = i === n - 1;
        p.fill(tint(p, top ? colors.accent : colors.text, top ? 255 : 200));
        p.rect(cx - 22, y + (i - dropped) * 60, 44, 58, 6);
        p.pop();
      }
      p.push();
      p.noStroke();
      p.fill('#ff8c42');
      p.triangle(cx - 16, y + (n - dropped) * 60, cx + 16, y + (n - dropped) * 60, cx, y + (n - dropped) * 60 + 46);
      p.pop();
      wire(p, width * 0.1, ground, width * 0.9, ground, colors.dim, 5);
    }),

  'scale-ladder': wide('Scale ladder',
    'things placed on a hugely stretched scale. Use for: orders of magnitude, distances in space, sizes',
    'items (3-6 things, each with a label and a value)',
    ({ p, progress, width, height, items, colors }) => {
      const vs = values(items, 6);
      if (!vs.length) return;
      const max = Math.max(...vs.map((v) => Math.abs(v.value)), 1);
      const y = height * 0.5;
      wire(p, width * 0.08, y, width * 0.92, y, colors.dim, 4);
      vs.forEach((v, i) => {
        const on = stagger(progress, i, 0.12);
        if (on <= 0) return;
        // Logarithmic, because a linear axis puts everything but the largest
        // at the same point - which is the thing the diagram is trying to show.
        const t = Math.log10(1 + Math.abs(v.value)) / safe(Math.log10(1 + max));
        const x = width * 0.08 + t * width * 0.84;
        junction(p, x, y, colors.accent, 18 * on);
        caption(p, v.label, x, y + (i % 2 ? 40 : -40), colors, 19);
      });
    }),

  'black-hole': square('Black hole',
    'light bending round a dark centre. Use for: black holes, gravity wells, spacetime curvature',
    'no parameters',
    ({ p, time, width, height, colors }) => {
      const cx = width / 2;
      const cy = height * 0.48;
      const r = Math.min(width, height) * 0.13;
      for (let i = 6; i >= 1; i--) {
        p.push();
        p.noFill();
        p.stroke(tint(p, colors.accent, 40 + i * 12));
        p.strokeWeight(3);
        p.circle(cx, cy, r * 2 * (1 + i * 0.42));
        p.pop();
      }
      p.push();
      p.noStroke();
      p.fill('#000000');
      p.circle(cx, cy, r * 2);
      p.noFill();
      p.stroke('#ff8c42');
      p.strokeWeight(6);
      p.ellipse(cx, cy, r * 3.4, r * 0.9);
      p.pop();
      for (let i = 0; i < 5; i++) {
        const a = time * 0.6 + i * 1.25;
        const rr = r * (2.2 + (i % 3) * 0.5);
        p.push();
        p.noStroke();
        p.fill(colors.text);
        p.circle(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.35, 9);
        p.pop();
      }
    }),

  // =========================================================================
  // Electrical machines, protection and analog
  // =========================================================================

  'induction-motor': square('Induction motor',
    'a rotating field dragging a rotor round behind it. Use for: induction motors, slip, rotating fields',
    'speed (1-5), ratio (0-0.2, the slip)',
    ({ p, time, width, height, params, colors }) => {
      const speed = num(params.speed, 3, 1, 5);
      const slip = num(params.ratio, 0.05, 0, 0.2);
      const cx = width / 2;
      const cy = height * 0.48;
      const r = Math.min(width, height) * 0.3;
      p.push();
      p.noFill();
      p.stroke(colors.dim);
      p.strokeWeight(6);
      p.circle(cx, cy, r * 2);
      p.pop();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + time * speed * 0.5;
        p.push();
        p.noStroke();
        p.fill(tint(p, colors.accent, 200));
        p.circle(cx + Math.cos(a) * r * 0.92, cy + Math.sin(a) * r * 0.92, 22);
        p.pop();
      }
      p.push();
      p.translate(cx, cy);
      p.rotate(time * speed * 0.5 * (1 - slip));
      p.stroke(colors.text);
      p.strokeWeight(5);
      p.fill(colors.bg);
      p.circle(0, 0, r * 1.1);
      p.line(-r * 0.5, 0, r * 0.5, 0);
      p.pop();
      caption(p, 'Rotor lags the field — that gap is slip', width / 2, height * 0.92, colors, 20);
    }),

  'circuit-breaker': wide('Circuit breaker',
    'a breaker tripping open on a fault. Use for: protection, breakers, fuses, tripping, fault clearing',
    'mode ("closed", "trip")',
    ({ p, progress, width, height, params, colors }) => {
      const tripped = String(params.mode || '') === 'trip' || progress > 0.55;
      const cy = height * 0.44;
      wire(p, width * 0.1, cy, width * 0.38, cy, colors.text, 5);
      wire(p, width * 0.62, cy, width * 0.9, cy, colors.text, 5);
      junction(p, width * 0.38, cy, colors.text, 14);
      junction(p, width * 0.62, cy, colors.text, 14);
      p.push();
      p.stroke(tripped ? '#ff6b6b' : colors.good);
      p.strokeWeight(6);
      p.noFill();
      if (tripped) p.line(width * 0.38, cy, width * 0.58, cy - height * 0.2);
      else p.line(width * 0.38, cy, width * 0.62, cy);
      p.pop();
      box(p, width / 2, height * 0.76, width * 0.34, height * 0.16,
          tripped ? 'TRIPPED' : 'CLOSED', colors, { lit: tripped });
    }),

  'fuse-curve': wide('Fuse characteristic',
    'how fast a fuse blows as the current rises. Use for: fuses, protection coordination, tripping times',
    'no parameters',
    ({ p, progress, width, height, colors }) => {
      const plot = axes(p, width, height, colors, { x: 'Current', y: 'Time' });
      curve(p, plot, (t) => 0.92 / (1 + t * 8), colors.accent, progress);
      caption(p, 'More current, faster trip', width / 2, height * 0.93, colors, 20);
    }),

  relay: wide('Relay',
    'a small coil closing a bigger contact. Use for: relays, contactors, control circuits, switching',
    'mode ("closed" to energise it)',
    ({ p, progress, width, height, params, colors }) => {
      const on = String(params.mode || '') === 'closed' || progress > 0.5;
      const cy = height * 0.5;
      box(p, width * 0.26, cy, width * 0.2, height * 0.3, 'Coil', colors, { lit: on });
      for (let i = 0; i < 4; i++) {
        p.push();
        p.noFill();
        p.stroke(on ? colors.accent : colors.dim);
        p.strokeWeight(4);
        p.arc(width * 0.26 - 30 + i * 20, cy, 20, 44, -Math.PI / 2, Math.PI / 2);
        p.pop();
      }
      setDash(p, true);
      wire(p, width * 0.36, cy, width * 0.56, cy, colors.dim, 3);
      setDash(p, false);
      wire(p, width * 0.6, cy - 40, width * 0.72, cy - 40, colors.text, 5);
      wire(p, width * 0.86, cy - 40, width * 0.92, cy - 40, colors.text, 5);
      p.push();
      p.stroke(on ? colors.good : colors.text);
      p.strokeWeight(5);
      if (on) p.line(width * 0.72, cy - 40, width * 0.86, cy - 40);
      else p.line(width * 0.72, cy - 40, width * 0.85, cy - 76);
      p.pop();
      caption(p, on ? 'Energised — contact closed' : 'Off — contact open', width / 2, height * 0.86, colors);
    }),

  'op-amp': wide('Op-amp',
    'a triangle amplifier with two inputs and feedback. Use for: op-amps, amplifiers, analog electronics, gain',
    'ratio (1-20, the gain)',
    ({ p, progress, width, height, params, colors }) => {
      const gain = num(params.ratio, 10, 1, 20);
      const cx = width * 0.54;
      const cy = height * 0.52;
      const s = Math.min(width * 0.16, height * 0.3);
      p.push();
      p.stroke(colors.accent);
      p.strokeWeight(5);
      p.fill(colors.bg);
      p.triangle(cx - s, cy - s, cx - s, cy + s, cx + s * 1.3, cy);
      p.pop();
      caption(p, '−', cx - s + 22, cy - s * 0.45, colors, 26);
      caption(p, '+', cx - s + 22, cy + s * 0.45, colors, 26);
      wire(p, width * 0.14, cy - s * 0.45, cx - s, cy - s * 0.45, colors.text);
      wire(p, width * 0.14, cy + s * 0.45, cx - s, cy + s * 0.45, colors.text);
      wire(p, cx + s * 1.3, cy, width * 0.9, cy, colors.text);
      if (progress > 0.4) {
        wire(p, width * 0.8, cy, width * 0.8, cy - s * 1.7, colors.dim, 4);
        wire(p, width * 0.8, cy - s * 1.7, width * 0.24, cy - s * 1.7, colors.dim, 4);
        wire(p, width * 0.24, cy - s * 1.7, width * 0.24, cy - s * 0.45, colors.dim, 4);
        resistor(p, width * 0.52, cy - s * 1.7, colors);
      }
      caption(p, 'Gain ' + Math.round(gain), cx + s * 0.2, cy + s * 0.9, colors, 22);
    }),

  'diode-curve': wide('Diode characteristic',
    'current staying flat then rising sharply past the knee. Use for: diodes, rectification, forward voltage',
    'no parameters',
    ({ p, progress, width, height, colors }) => {
      const plot = axes(p, width, height, colors, { x: 'Voltage', y: 'Current' });
      curve(p, plot, (t) => (t < 0.45 ? 0.06 : 0.06 + Math.pow((t - 0.45) * 3.4, 2.2)), colors.accent, progress);
      if (progress > 0.6) {
        setDash(p, true);
        wire(p, plot.x(0.45), plot.bottom, plot.x(0.45), plot.y(0.5), colors.dim, 2);
        setDash(p, false);
        caption(p, 'Knee', plot.x(0.45), plot.bottom + 26, colors, 19);
      }
    }),

  transistor: wide('Transistor',
    'a transistor switching a load on. Use for: transistors, switching, amplification, base current',
    'mode ("on" or "off")',
    ({ p, progress, width, height, params, colors }) => {
      const on = String(params.mode || '') === 'on' || progress > 0.5;
      const cx = width * 0.52;
      const cy = height * 0.5;
      p.push();
      p.stroke(colors.text);
      p.strokeWeight(6);
      p.line(cx, cy - 46, cx, cy + 46);
      p.pop();
      wire(p, width * 0.2, cy, cx, cy, on ? colors.accent : colors.dim, 5);
      wire(p, cx, cy - 46, width * 0.78, cy - 96, colors.text, 5);
      wire(p, cx, cy + 46, width * 0.78, cy + 96, colors.text, 5);
      arrow(p, cx + 8, cy + 46, width * 0.72, cy + 90, on ? colors.accent : colors.dim, 4, 12);
      caption(p, 'Base', width * 0.16, cy - 26, colors, 20);
      caption(p, 'Collector', width * 0.84, cy - 96, colors, 20);
      caption(p, 'Emitter', width * 0.84, cy + 96, colors, 20);
      caption(p, on ? 'Base current — it conducts' : 'No base current — it blocks',
              width / 2, height * 0.9, colors, 20);
    }),

  'filter-response': wide('Filter response',
    'which frequencies a filter lets through. Use for: filters, low pass, high pass, bandwidth, cutoff',
    'mode ("low", "high" or "band")',
    ({ p, progress, width, height, params, colors }) => {
      const mode = String(params.mode || 'low');
      const plot = axes(p, width, height, colors, { x: 'Frequency', y: 'Output' });
      const fn = (t: number) => {
        if (mode === 'high') return 0.85 / (1 + Math.exp(-(t - 0.45) * 12));
        if (mode === 'band') return 0.85 * Math.exp(-Math.pow((t - 0.5) * 6, 2));
        return 0.85 / (1 + Math.exp((t - 0.55) * 12));
      };
      curve(p, plot, fn, colors.accent, progress);
      caption(p, mode + ' pass', width / 2, height * 0.93, colors, 22);
    }),

  'wheatstone-bridge': square('Bridge circuit',
    'four arms in a diamond with a meter across the middle. Use for: Wheatstone bridge, measurement, balancing, null methods',
    'labelA (the unknown arm)',
    ({ p, progress, width, height, params, colors }) => {
      const cx = width / 2;
      const cy = height * 0.48;
      const r = Math.min(width, height) * 0.3;
      const pts = [
        { x: cx, y: cy - r }, { x: cx + r, y: cy }, { x: cx, y: cy + r }, { x: cx - r, y: cy },
      ];
      pts.forEach((q, i) => {
        const n = pts[(i + 1) % 4];
        const on = stagger(progress, i, 0.12);
        if (on <= 0) return;
        wire(p, q.x, q.y, n.x, n.y, colors.text, 4);
        const mx = (q.x + n.x) / 2;
        const my = (q.y + n.y) / 2;
        p.push();
        p.stroke(i === 3 ? colors.accent : colors.text);
        p.strokeWeight(4);
        p.fill(colors.bg);
        p.rect(mx - 22, my - 13, 44, 26, 3);
        p.pop();
      });
      pts.forEach((q) => junction(p, q.x, q.y, colors.text, 14));
      wire(p, pts[3].x, pts[3].y, pts[1].x, pts[1].y, colors.dim, 3);
      bubble(p, cx, cy, 26, 'G', colors, { lit: true, size: 20 });
      caption(p, clean(params.labelA, 10) || 'Unknown', cx - r * 0.7, cy - r * 0.62, colors, 18);
    }),

  multimeter: square('Meter reading',
    'a meter with a value on its display. Use for: measurement, instruments, readings, accuracy',
    'labelA (what is measured), labelB (the reading)',
    ({ p, progress, width, height, params, colors }) => {
      const cx = width / 2;
      const cy = height * 0.46;
      const w = Math.min(width * 0.6, height * 0.6);
      p.push();
      p.stroke(colors.text);
      p.strokeWeight(5);
      p.fill(tint(p, colors.dim, 40));
      p.rect(cx - w / 2, cy - w * 0.6, w, w * 1.2, 14);
      p.noStroke();
      p.fill(tint(p, colors.good, 60));
      p.rect(cx - w * 0.4, cy - w * 0.44, w * 0.8, w * 0.34, 6);
      p.pop();
      if (progress > 0.3) {
        title(p, clean(params.labelB, 8) || '12.4', cx, cy - w * 0.27, colors, w * 0.2);
      }
      caption(p, clean(params.labelA, 14) || 'Volts', cx, cy + w * 0.2, colors, 22);
      [-1, 1].forEach((s) => junction(p, cx + s * w * 0.26, cy + w * 0.46, colors.accent, 20));
    }),

  'wiring-layout': wide('Wiring layout',
    'a supply feeding points through a board. Use for: house wiring, distribution boards, circuits in a building',
    'items (2-5 points, each with a label)',
    ({ p, progress, width, height, items, colors }) => {
      const names = labels(items, 5);
      const points = names.length ? names : ['Light', 'Socket', 'Fan'];
      const busY = height * 0.32;
      box(p, width * 0.14, busY, width * 0.16, height * 0.2, 'Board', colors, { lit: true });
      wire(p, width * 0.22, busY, width * 0.92, busY, colors.text, 5);
      const xs = spread(points.length, width * 0.36, width * 0.86);
      points.forEach((n, i) => {
        const on = stagger(progress, i, 0.14);
        if (on <= 0) return;
        junction(p, xs[i], busY, colors.text, 12);
        wire(p, xs[i], busY, xs[i], busY + height * 0.24 * on, colors.dim, 4);
        box(p, xs[i], busY + height * 0.34, width * 0.16, height * 0.16, n, colors);
      });
    }),

  // =========================================================================
  // Coding and decoding
  // =========================================================================

  'letter-shift': wide('Letter shift',
    'letters moved along the alphabet by a fixed step. Use for: coding-decoding, ciphers, letter series',
    'count (1-25, the shift - the caption prints it), labelA (the word)',
    ({ p, progress, width, height, params, colors }) => {
      // Printed as "+N each letter", so a shift of 13 must stay 13.
      const shift = Math.round(num(params.count, 2, 1, 25));
      const word = (clean(params.labelA, 6) || 'CODE').toUpperCase();
      const xs = spread(word.length, width * 0.2, width * 0.8);
      word.split('').forEach((ch, i) => {
        const on = stagger(progress, i, 0.14);
        if (on <= 0) return;
        title(p, ch, xs[i], height * 0.3, colors, 40);
        arrow(p, xs[i], height * 0.4, xs[i], height * 0.56, colors.accent, 3, 10);
        const code = ch.charCodeAt(0);
        const next = code >= 65 && code <= 90
          ? String.fromCharCode(((code - 65 + shift) % 26) + 65) : ch;
        if (on > 0.6) title(p, next, xs[i], height * 0.68, colors, 40);
      });
      caption(p, '+' + shift + ' each letter', width / 2, height * 0.88, colors, 22);
    }),

  'alphabet-position': wide('Letter positions',
    'letters with their position in the alphabet under them. Use for: coding-decoding, letter-number problems, series',
    'labelA (the word)',
    ({ p, progress, width, height, params, colors }) => {
      const word = (clean(params.labelA, 7) || 'MATH').toUpperCase();
      const xs = spread(word.length, width * 0.18, width * 0.82);
      word.split('').forEach((ch, i) => {
        const on = stagger(progress, i, 0.12);
        if (on <= 0) return;
        title(p, ch, xs[i], height * 0.38, colors, 42);
        const code = ch.charCodeAt(0);
        const pos = code >= 65 && code <= 90 ? code - 64 : 0;
        p.push();
        p.noStroke();
        p.fill(tint(p, colors.accent, 170));
        p.circle(xs[i], height * 0.62, 52);
        p.pop();
        caption(p, String(pos), xs[i], height * 0.62, colors, 24);
      });
    }),

  'symbol-key': wide('Symbol key',
    'a legend pairing symbols with what they mean. Use for: coding-decoding, symbol substitution, legends',
    'items (2-5 pairs; label is the meaning, symbol is the code)',
    ({ p, progress, width, height, items, colors }) => {
      const pairs = (items || []).slice(0, 5).filter((i) => i && i.label);
      if (!pairs.length) return;
      const rowH = (height * 0.62) / safe(pairs.length);
      pairs.forEach((pair, i) => {
        const on = stagger(progress, i, 0.14);
        if (on <= 0) return;
        const y = height * 0.24 + i * rowH;
        p.push();
        p.noStroke();
        p.fill(tint(p, colors.accent, 180));
        p.circle(width * 0.32, y, 54);
        p.pop();
        caption(p, clean(pair.symbol, 3) || '?', width * 0.32, y, colors, 24);
        arrow(p, width * 0.38, y, width * 0.48, y, colors.dim, 3, 10);
        title(p, clean(pair.label, 16), width * 0.64, y, colors, 24);
      });
    }),
};
