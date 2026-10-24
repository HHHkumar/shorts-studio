// ---------------------------------------------------------------------------
// Which sketches a video is shown.
//
// The library has over two hundred sketches, and every one of them used to be
// described in every request: about nine tenths of everything the model was
// told. A script on transformer testing was offered a DNA helix, a seating
// puzzle and the parts of speech, each with its knobs and its rules - and the
// forty lines that mattered to it, how to write a circuit so it is drawn with
// its real parts, were somewhere in the middle.
//
// A model given two hundred choices picks the nearest thing more often than
// the right thing. So the library is kept on shelves by subject, and a video
// is shown the shelves for its own subject and the ones every subject shares.
// Nothing is removed: a sketch named from another shelf is still drawn if it
// is asked for by name, and a subject nobody has a shelf for sees them all.
// ---------------------------------------------------------------------------

/** Every shelf, and the sketches on it. A sketch may be on more than one. */
export const SHELVES = {
  // Circuits, machines, power, electronics, measurement and the fields behind them.
  electrical: [
    'circuit', 'phasors', 'phasor', 'waveform', 'power-factor', 'three-phase', 'star-delta', 'rms-value',
    'rc-charging', 'rectifier', 'transformer', 'transformer-efficiency', 'motor', 'induction-motor',
    'torque-slip', 'dc-generator', 'dc-motor-curves', 'stepper-motor', 'v-curves', 'magnetisation-curve',
    'hysteresis-loop', 'resonance-curve', 'filter-response', 'scr-characteristic', 'diode-curve', 'transistor',
    'op-amp', 'led-circuit', 'switch-circuit', 'relay', 'circuit-breaker', 'fuse-curve', 'earthing',
    'wiring-layout', 'wheatstone-bridge', 'multimeter', 'oscilloscope', 'sensor-chain', 'kirchhoff',
    'capacitor-field', 'material-bands', 'superconductor', 'power-time', 'magnetism', 'vector-field',
    'sine-wave', 'logic-gate', 'truth-table', 'binary-number', 'timing-diagram', 'carnot-cycle', 'heat-transfer', 'energy-levels',
    // Borrowed from other subjects for the papers that need them: materials,
    // electroplating, a line that is not matched, a diesel station.
    'atom', 'electrolysis', 'standing-wave', 'engine-cycle',
  ],
  physics: [
    'wave-interference', 'sine-wave', 'projectile', 'pendulum', 'vector-field', 'particles', 'refraction',
    'lever', 'pulley', 'incline', 'gears', 'spring', 'collision', 'friction', 'torque', 'free-fall', 'buoyancy',
    'momentum', 'reflection', 'lens', 'prism', 'standing-wave', 'doppler', 'diffraction', 'heat-transfer',
    'phase-change', 'gas-laws', 'bernoulli', 'newton-laws', 'nuclear-decay', 'energy-levels', 'carnot-cycle',
    'magnetism', 'atom', 'circuit', 'vector-add', 'truss', 'engine-cycle', 'failure-point', 'orbit',
    'power-time', 'superconductor', 'capacitor-field',
  ],
  chemistry: [
    'atom', 'molecule', 'ph-scale', 'titration', 'electrolysis', 'states-of-matter', 'reaction-energy',
    'periodic-block', 'mole', 'redox', 'organic-chain', 'particles', 'gas-laws', 'phase-change',
    'metal-nonmetal', 'energy-levels',
  ],
  biology: [
    'cell', 'dna', 'neuron', 'heart', 'photosynthesis', 'food-chain', 'mitosis', 'respiration', 'ecosystem',
    'microbe', 'biotech', 'brain-regions', 'memory-stages', 'synapse', 'reflex-arc', 'conditioning',
    'bias-scale', 'stress-curve', 'sleep-cycle', 'personality-axes', 'conformity', 'perception', 'vitamin-table',
  ],
  earth: [
    'orbit', 'solar-system', 'moon-phases', 'seasons', 'water-cycle', 'earth-layers', 'plate-tectonics',
    'star-lifecycle', 'eclipse', 'rocket-stages', 'scale-ladder', 'black-hole', 'pollution-source',
    'recycling', 'ozone-layer', 'river-map', 'ecosystem', 'food-chain',
  ],
  maths: [
    'graph', 'triangle', 'pythagoras', 'coordinate-plane', 'quadratic', 'set-operations', 'function-machine',
    'fraction-bar', 'angles', 'matrix', 'vector-add', 'area-under', 'slope-tangent', 'probability-tree',
    'number-grid', 'logarithm', 'complex-plane', 'normal-curve', 'box-plot', 'regression-line', 'sampling',
    'unit-circle', 'solids', 'eigenvector', 'differential-equation', 'number-line', 'venn',
  ],
  // The part of mathematics an engineering paper leans on, without the school geometry.
  analysis: [
    'graph', 'complex-plane', 'matrix', 'differential-equation', 'logarithm', 'unit-circle', 'area-under',
    'slope-tangent', 'eigenvector', 'normal-curve', 'number-line', 'vector-add',
  ],
  aptitude: [
    'venn', 'clock', 'number-line', 'ratio-bar', 'seating', 'tree', 'grid-logic', 'cube-net', 'dice',
    'paper-fold', 'mirror-image', 'compass', 'matrix-puzzle', 'profit-loss', 'letter-shift',
    'alphabet-position', 'symbol-key', 'alligation', 'calendar', 'rounding-line', 'fraction-bar',
    'compound-growth', 'emi-schedule', 'probability-tree', 'number-grid', 'triangle', 'angles', 'solids',
    'pythagoras', 'coordinate-plane', 'set-operations',
  ],
  english: [
    'parts-of-speech', 'sentence-parts', 'tense-timeline', 'active-passive', 'para-jumble', 'word-pair',
    'comprehension-map',
  ],
  economics: [
    'supply-demand', 'inflation', 'business-cycle', 'compound-growth', 'emi-schedule', 'trade-flow',
    'banking', 'economic-indicators', 'profit-loss', 'gov-structure',
  ],
  computing: [
    'logic-gate', 'truth-table', 'binary-number', 'timing-diagram', 'network-topology', 'layer-stack', 'cpu-cycle',
    'sorting-steps', 'binary-search', 'packet-route', 'database-table', 'cyber-safety',
    'generations-timeline', 'recursion', 'cryptography', 'tree',
  ],
  // What every subject can use: a process, a list, a comparison, a chart of its own numbers.
  shared: [
    'block-flow', 'flowchart', 'cycle', 'pyramid', 'before-after', 'checklist', 'scale-balance',
    'misconception', 'pie', 'histogram', 'scatter', 'line-chart', 'stacked-bar', 'gauge', 'funnel',
    'matrix-quadrant', 'ratio-bar', 'number-line', 'graph', 'manufacturing', 'tree',
  ],
};

/** The shelves each kind of video is shown, besides the shared one. */
const BY_SUBJECT = [
  // First, so that "Network Theory / Circuits" is not taken for computer networking.
  [/electr|circuit|power|control system|signal|instrument|switchgear|transmission/i, ['electrical', 'analysis']],
  [/physic|mechanic|optic|thermo|quantum|nuclear/i, ['physics', 'maths']],
  [/chemi/i, ['chemistry', 'physics']],
  [/biolog|medicine|human body|neuro|psycholog|health|genetic/i, ['biology', 'chemistry']],
  [/astronom|space|earth|environment|geograph|climate/i, ['earth', 'physics']],
  [/econom|financ|business|commerce/i, ['economics', 'maths']],
  [/computer|program|software|algorithm|data structure|network/i, ['computing', 'maths']],
  [/math|statistic|probab|algebra|calculus|geometr|trigonometr/i, ['maths']],
  [/english|grammar|verbal|comprehension|vocabular/i, ['english']],
];

/**
 * The shelves for a video, or null when it should be shown the whole library:
 * a subject this does not recognise is not guessed at.
 */
export function shelvesFor(options) {
  const o = options || {};
  const subject = String(o.subject || '');
  if (o.contentType === 'electrical') {
    // Engineering Mathematics is a paper of its own and wants the whole maths shelf.
    return /math|statistic|probab/i.test(subject) ? ['electrical', 'analysis', 'maths', 'shared'] : ['electrical', 'analysis', 'shared'];
  }
  if (o.contentType === 'aptitude') {
    // The last sections of that paper are not aptitude at all, and a science
    // question handed only seating puzzles would be drawn as one.
    if (/english|verbal|grammar|comprehension/i.test(subject)) return ['english', 'aptitude', 'shared'];
    if (/general science/i.test(subject)) return ['physics', 'chemistry', 'biology', 'earth', 'shared'];
    if (/computer/i.test(subject)) return ['computing', 'shared'];
    if (/awareness|current affairs|\bgk\b|general knowledge|history|geography|polity/i.test(subject)) return null;
    return ['aptitude', 'maths', 'shared'];
  }
  // By the subject alone. A topic is free text, and "the power of compounding"
  // is not a question about power.
  const hit = BY_SUBJECT.find(([re]) => re.test(subject));
  return hit ? [...hit[1], 'shared'] : null;
}

/**
 * The names a video is shown, in the library's own order. A sketch that is on
 * no shelf at all is shown to everyone, so one added later is never hidden by
 * an oversight here.
 */
export function shortlist(allNames, options) {
  const shelves = shelvesFor(options);
  if (!shelves) return allNames;
  const shelved = new Set(Object.values(SHELVES).flat());
  const wanted = new Set(shelves.flatMap((s) => SHELVES[s] || []));
  return allNames.filter((n) => wanted.has(n) || !shelved.has(n));
}
