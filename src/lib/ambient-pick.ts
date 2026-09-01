// ---------------------------------------------------------------------------
// Choosing a backdrop that suits the subject.
//
// A backdrop nobody chose is decoration; a backdrop that matches what is being
// talked about is atmosphere. A grid explainer under a drifting circuit board
// reads as deliberate, the same explainer under a galaxy spiral reads as a
// screensaver somebody forgot to turn off.
//
// Deliberately keyword matching and not a model call: it has to be instant,
// free, and the same every time for the same topic.
// ---------------------------------------------------------------------------

/** Checked in order, so put the specific words before the general ones. */
const RULES: { name: string; words: string[] }[] = [
  { name: 'board', words: ['circuit', 'electronic', 'semiconductor', 'transistor', 'pcb', 'logic', 'microprocessor', 'digital'] },
  { name: 'lattice', words: ['grid', 'transmission', 'distribution', 'substation', 'network', 'feeder', 'busbar'] },
  { name: 'equaliser', words: ['power', 'generation', 'turbine', 'boiler', 'plant', 'load', 'demand', 'generator', 'thermal'] },
  { name: 'scope', words: ['signal', 'oscillat', 'frequency', 'harmonic', 'waveform', 'alternating', 'phase', 'inverter'] },
  { name: 'ripple', words: ['wave', 'sound', 'acoustic', 'vibration', 'resonance', 'interference', 'optic', 'light'] },
  { name: 'galaxy', words: ['space', 'astronom', 'planet', 'star', 'orbit', 'galaxy', 'cosmo', 'universe', 'satellite'] },
  { name: 'atom', words: ['atom', 'nuclear', 'quantum', 'electron', 'particle', 'radioact', 'isotope', 'fission'] },
  { name: 'mesh', words: ['chemistry', 'molecul', 'bond', 'crystal', 'polymer', 'material', 'compound', 'reaction'] },
  { name: 'smoke', words: ['fluid', 'gas', 'steam', 'flow', 'thermodynam', 'heat', 'pressure', 'aerodynam', 'combustion'] },
  { name: 'embers', words: ['fire', 'energy', 'fuel', 'coal', 'engine', 'furnace', 'temperature'] },
  { name: 'topo', words: ['earth', 'geolog', 'climate', 'environment', 'weather', 'ocean', 'terrain', 'renewable', 'solar', 'wind'] },
  { name: 'constellation', words: ['data', 'algorithm', 'computer', 'ai', 'machine learning', 'software', 'internet', 'communication'] },
  { name: 'spectrum', words: ['statistic', 'probabilit', 'economic', 'measure', 'analysis'] },
  { name: 'vortex', words: ['maths', 'math', 'geometr', 'calculus', 'number', 'algebra', 'infinity', 'fractal'] },
  { name: 'dust', words: ['biolog', 'cell', 'gene', 'medicine', 'body', 'brain', 'evolution', 'health'] },
];

/** The fallback when nothing matches - quiet, and it suits any subject. */
const DEFAULT_AMBIENT = 'dust';

/**
 * Pick a backdrop from whatever text describes the video. Give it the subject,
 * topic and question; more words is better, and order does not matter.
 */
export function pickAmbient(...text: (string | undefined)[]): string {
  const haystack = text.filter(Boolean).join(' ').toLowerCase();
  if (!haystack.trim()) return DEFAULT_AMBIENT;

  for (const rule of RULES) {
    if (rule.words.some((w) => haystack.includes(w))) return rule.name;
  }
  return DEFAULT_AMBIENT;
}
