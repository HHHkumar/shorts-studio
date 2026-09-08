// ---------------------------------------------------------------------------
// What the model is told about the animation library.
//
// GENERATED FILE - do not edit by hand. Every change here is overwritten.
//
//     node --import ./tools/ts-resolve.mjs tools/sync-catalogue.mjs
//
// The implementations live in src/remotion/sketches.ts and sketches-extra.ts,
// which the server cannot import because it is TypeScript. This is the copy it
// can, derived from those files so the two can never disagree about which
// sketches exist.
// ---------------------------------------------------------------------------

export const SKETCH_CATALOGUE = [
  { name: 'wave-interference', describe: 'Two sources sending out ripples that add and cancel. Use for interference, sound, water waves, the double slit.', uses: 'frequency (1-5, ripple tightness), speed (1-5)' },
  { name: 'sine-wave', describe: 'One or two sine waves moving across the screen, optionally with their sum. Use for waves, sound, oscillation, superposition.', uses: 'frequency (1-6), amplitude (0.2-1), count (1 or 2; 2 adds a second wave and their sum)' },
  { name: 'orbit', describe: 'Bodies circling a central mass at different periods. Use for planets, moons, satellites, orbital period questions.', uses: 'count (1-3 orbiting bodies), ratio (0.3-3, how much slower each outer body is), labelA (centre), labelB (first orbiter)' },
  { name: 'projectile', describe: 'A ball launched at an angle, tracing its arc. Use for projectile motion, range, trajectory, gravity questions.', uses: 'angle (15-75 degrees), speed (1-5)' },
  { name: 'pendulum', describe: 'A bob swinging on a string. Use for periodic motion, period and length, energy conversion.', uses: 'amplitude (10-60 degrees), speed (0.5-3)' },
  { name: 'vector-field', describe: 'A grid of arrows showing a field. Use for gravity, electric and magnetic fields, fluid flow.', uses: 'mode ("radial" for a point source, "rotational" for a magnetic-style curl, "uniform" for a constant field)' },
  { name: 'particles', describe: 'Particles scattering out from a point. Use for diffusion, gases, entropy, Brownian motion, radiation.', uses: 'count (20-120), speed (0.5-2)' },
  { name: 'graph', describe: 'Draws a curve on axes, revealed left to right. Use for showing how one quantity depends on another.', uses: 'mode ("linear", "quadratic", "cubic", "exponential", "inverse-square", "sine", "log"), labelA (x axis), labelB (y axis)' },
  { name: 'atom', describe: 'A nucleus with electrons circling in shells. Use for atomic structure, electron shells, isotopes, bonding.', uses: 'count (1-3 shells), amplitude (1-8 electrons on the outer shell), labelA (element name)' },
  { name: 'refraction', describe: 'A light ray bending as it crosses a boundary. Use for refraction, lenses, Snell’s law, why a straw looks bent.', uses: 'angle (10-70 degrees of incidence), ratio (1.1-2.4, refractive index of the lower medium), labelA / labelB (the two media)' },
  { name: 'circuit', describe: 'a source with two or three components in series or parallel. Use for: series and parallel resistance, current division, basic circuit questions', uses: 'mode ("series" or "parallel"), count (2-3), labelA (source), items (component labels)' },
  { name: 'phasor', describe: 'voltage and current phasors with the angle between them, or the power triangle. Use for: power factor, leading and lagging loads, real and reactive power', uses: 'angle (-90 to 90 degrees), mode ("phasor" or "power-triangle"), labelA, labelB' },
  { name: 'waveform', describe: 'an AC waveform: two signals out of phase, or a rectified or switched output. Use for: AC theory, phase shift, rectifiers, inverters and PWM', uses: 'mode ("phase", "half-wave", "full-wave", "pwm"), angle (phase shift in degrees), frequency (1-4)' },
  { name: 'block-flow', describe: 'labelled boxes joined by arrows, lighting up in order - a process or plant flow. Use for: a process or plant flow: boiler to turbine to condenser, or any staged sequence', uses: 'items (3-5 stage labels, e.g. Boiler, Turbine, Condenser, Pump)' },
  { name: 'transformer', describe: 'a core with primary and secondary windings, for turns ratio and voltage transformation. Use for: turns ratio, step-up and step-down, voltage and current transformation', uses: 'ratio (0.2-5, secondary turns relative to primary), labelA (primary), labelB (secondary)' },
  { name: 'pie', describe: 'a pie showing how a whole splits up - shares, losses, a fuel mix. Use for: shares, losses, a fuel mix, where the energy goes', uses: 'items (2-5 slices, each with a label and a value; they need not add to 100)' },
  { name: 'venn', describe: 'two or three overlapping circles, for syllogism, sets and shared properties. Use for: syllogism, sets, shared properties, "both", classification', uses: 'count (2 or 3 circles), items (one label per circle), labelA (what the overlap means)' },
  { name: 'clock', describe: 'a clock with both hands, and the angle between them marked. Use for: clock problems, angles between hands, time, anything on a dial', uses: 'angle (the hour, 1-12), ratio (the minute, 0-59), mode ("angle" to shade the gap between the hands)' },
  { name: 'number-line', describe: 'a line with marked points, for ranges, inequalities and where a value sits. Use for: inequalities, ranges, where a value sits, ordering, temperature', uses: 'items (2-6 points, each with a label and a value), labelA (left end), labelB (right end)' },
  { name: 'ratio-bar', describe: 'one bar split into proportional parts, for ratios, shares and percentages. Use for: ratios, shares, percentage splits, "divided in the ratio"', uses: 'items (2-5 parts, each with a label and a value; they need not add to 100)' },
  { name: 'seating', describe: 'people placed around a table, for circular and linear arrangement puzzles. Use for: seating arrangement, circular arrangement, who sits where', uses: 'items (3-8 people, each with a label), mode ("circle" or "row"), labelA (who faces which way)' },
  { name: 'tree', describe: 'a branching diagram, for family trees, blood relations and classifications. Use for: family trees, blood relations, hierarchies, classification, org charts', uses: 'items (3-7 nodes; the first is the root, the rest hang below it), labelA (what the links mean)' },
  { name: 'histogram', describe: 'bars over categories with a value axis, for data interpretation and distributions. Use for: data interpretation, distributions, comparing several categories', uses: 'items (3-8 bars, each with a label and a value), labelA (what the values measure)' },
  { name: 'grid-logic', describe: 'a tick-and-cross matrix, for matching puzzles and elimination reasoning. Use for: matching puzzles, elimination reasoning, two-variable logic problems', uses: 'items (2-4 row labels), labelA and labelB (two column headings), mode ("diagonal" to tick the diagonal)' },
  { name: 'lever', describe: 'a beam on a pivot with loads either side', uses: 'ratio (0.2-3, where the pivot sits), labelA (left load), labelB (right load)' },
  { name: 'pulley', describe: 'one or two wheels with a rope and a hanging load', uses: 'count (1-2 pulleys), labelA (the load)' },
  { name: 'incline', describe: 'a block on a slope with its forces marked', uses: 'angle (10-60 degrees), labelA (the block)' },
  { name: 'gears', describe: 'two meshed gears turning in opposite directions', uses: 'ratio (1-4, size of the second gear), speed (1-5)' },
  { name: 'spring', describe: 'a mass on a spring oscillating', uses: 'frequency (1-5), amplitude (0.2-1)' },
  { name: 'collision', describe: 'two bodies meeting and rebounding', uses: 'ratio (0.2-3, mass of the second body), mode ("elastic" or "inelastic")' },
  { name: 'friction', describe: 'a block pulled across a surface, with the forces named', uses: 'labelA (what is being pulled)' },
  { name: 'torque', describe: 'a force applied at a distance from a pivot', uses: 'angle (0-90, where the force is applied), labelA (the force)' },
  { name: 'free-fall', describe: 'objects dropped together, falling at the same rate', uses: 'count (1-3 objects), labelA (the surface, e.g. "vacuum")' },
  { name: 'buoyancy', describe: 'an object floating or sinking, with the displaced water shown', uses: 'ratio (0.2-2, density against the liquid)' },
  { name: 'momentum', describe: 'mass and velocity combining into one quantity', uses: 'items (2 bodies with a label and a value)' },
  { name: 'reflection', describe: 'a ray bouncing off a surface at an equal angle', uses: 'angle (10-80 degrees)' },
  { name: 'lens', describe: 'rays converging or diverging through a lens', uses: 'mode ("convex" or "concave"), labelA (the object)' },
  { name: 'prism', describe: 'white light splitting into a spectrum', uses: 'angle (30-70, the prism angle)' },
  { name: 'standing-wave', describe: 'a wave with fixed nodes and moving antinodes', uses: 'count (1-5 loops), frequency (1-5)' },
  { name: 'doppler', describe: 'a moving source bunching its waves ahead of it', uses: 'speed (1-5, how fast the source moves)' },
  { name: 'diffraction', describe: 'waves spreading after passing through a gap', uses: 'amplitude (0.2-1, how wide the gap is)' },
  { name: 'heat-transfer', describe: 'heat moving from a hot body to a cold one', uses: 'labelA (hot side), labelB (cold side), mode ("conduction", "convection" or "radiation")' },
  { name: 'phase-change', describe: 'a heating curve with flat plateaus at each change of state', uses: 'labelA (the substance)' },
  { name: 'gas-laws', describe: 'a piston squeezing a gas, with pressure rising as volume falls', uses: 'ratio (0.3-1, how far it is compressed)' },
  { name: 'bernoulli', describe: 'fluid speeding up through a narrow section', uses: 'ratio (0.2-0.8, how narrow the throat is)' },
  { name: 'molecule', describe: 'atoms joined by bonds', uses: 'count (2-5 outer atoms), labelA (centre atom), items (outer atom labels)' },
  { name: 'ph-scale', describe: 'where a substance sits from acid to alkali', uses: 'ratio (0-14, the pH), labelA (the substance)' },
  { name: 'titration', describe: 'liquid added drop by drop until the colour turns', uses: 'ratio (0-1, how far through the titration)' },
  { name: 'electrolysis', describe: 'two electrodes in a solution with ions moving to each', uses: 'labelA (cathode), labelB (anode)' },
  { name: 'states-of-matter', describe: 'particles arranged as solid, liquid and gas', uses: 'mode ("all", "solid", "liquid" or "gas")' },
  { name: 'reaction-energy', describe: 'energy over the course of a reaction, with the barrier', uses: 'mode ("exothermic" or "endothermic")' },
  { name: 'periodic-block', describe: 'one element as it appears on the table', uses: 'labelA (symbol), labelB (name), ratio (atomic number)' },
  { name: 'cell', describe: 'a cell with its labelled parts', uses: 'items (2-5 parts, each with a label), mode ("animal" or "plant")' },
  { name: 'dna', describe: 'a double helix with base pairs', uses: 'count (6-14 rungs)' },
  { name: 'neuron', describe: 'a nerve cell with a signal travelling down the axon', uses: 'labelA (what the signal is)' },
  { name: 'heart', describe: 'the four chambers and the direction blood flows', uses: 'labelA (a chamber to highlight)' },
  { name: 'photosynthesis', describe: 'light, water and CO2 going in, sugar and oxygen coming out', uses: 'labelA (what is being made)' },
  { name: 'food-chain', describe: 'energy passing along a chain of organisms', uses: 'items (3-5 organisms, each with a label)' },
  { name: 'mitosis', describe: 'one cell splitting into two', uses: 'progress drives the split; no parameters' },
  { name: 'triangle', describe: 'a labelled triangle with its sides and angles', uses: 'angle (20-120, the marked angle), labelA/labelB (side labels)' },
  { name: 'pythagoras', describe: 'squares built on the three sides of a right triangle', uses: 'ratio (0.4-1.5, shape of the triangle)' },
  { name: 'coordinate-plane', describe: 'points plotted on x and y axes', uses: 'items (2-6 points; value is y, label is the name)' },
  { name: 'quadratic', describe: 'a parabola with its roots and turning point', uses: 'ratio (-2 to 2, how the curve opens)' },
  { name: 'set-operations', describe: 'union, intersection or difference of two sets', uses: 'mode ("union", "intersection" or "difference"), labelA/labelB (set names)' },
  { name: 'function-machine', describe: 'an input going into a rule and a result coming out', uses: 'labelA (the rule), labelB (the input)' },
  { name: 'fraction-bar', describe: 'a bar split into equal parts with some shaded', uses: 'count (2-12 parts), ratio (how many are shaded)' },
  { name: 'angles', describe: 'angles around a point or on a line', uses: 'items (2-4 angles, each with a label and a value in degrees)' },
  { name: 'rc-charging', describe: 'the charging curve of a capacitor through a resistor', uses: 'mode ("charge" or "discharge")' },
  { name: 'rectifier', describe: 'AC turned into pulsing DC', uses: 'mode ("half" or "full")' },
  { name: 'three-phase', describe: 'three sine waves 120 degrees apart', uses: 'frequency (1-4)' },
  { name: 'motor', describe: 'a rotor turning inside a magnetic field', uses: 'speed (1-5)' },
  { name: 'led-circuit', describe: 'a source, a resistor and an LED that lights up', uses: 'labelA (supply), labelB (resistor value)' },
  { name: 'star-delta', describe: 'the two ways three windings can be connected', uses: 'mode ("star", "delta" or "both")' },
  { name: 'switch-circuit', describe: 'a circuit that only works when the switch is closed', uses: 'mode ("open" or "closed")' },
  { name: 'earthing', describe: 'an appliance bonded to earth', uses: 'labelA (the appliance)' },
  { name: 'power-factor', describe: 'real, reactive and apparent power as a triangle', uses: 'angle (0-70, the phase angle)' },
  { name: 'cube-net', describe: 'a folded cube beside its flat net', uses: 'mode ("cross" or "tee")' },
  { name: 'dice', describe: 'two views of a die, for opposite-face problems', uses: 'count (1-6, the face shown), ratio (1-6, the second face)' },
  { name: 'paper-fold', describe: 'a sheet folded and punched, then opened out', uses: 'count (1-2 folds)' },
  { name: 'mirror-image', describe: 'a shape and its reflection across a line', uses: 'labelA (the shape letter)' },
  { name: 'compass', describe: 'a compass with a path turning across it', uses: 'items (2-5 moves, each with a label)' },
  { name: 'matrix-puzzle', describe: 'a three by three grid with one cell missing', uses: 'items (up to 8 cell labels); the last cell is always the question mark' },
  { name: 'profit-loss', describe: 'cost, selling price and the gap between them', uses: 'items (2 bars: cost and selling price, each with a label and a value)' },
  { name: 'scatter', describe: 'points showing whether two things move together', uses: 'items (3-8 points, value is y), ratio (-1 to 1, how strong the trend is)' },
  { name: 'line-chart', describe: 'a value tracked over time', uses: 'items (3-8 points, each with a label and a value)' },
  { name: 'stacked-bar', describe: 'categories each split into parts', uses: 'items (3-6 bars, each with a label and a value)' },
  { name: 'gauge', describe: 'a single value on a dial', uses: 'ratio (0-1, how full), labelA (what it measures)' },
  { name: 'funnel', describe: 'a quantity narrowing at each stage', uses: 'items (3-5 stages, each with a label and a value)' },
  { name: 'matrix-quadrant', describe: 'four quadrants formed by two axes', uses: 'labelA (x axis), labelB (y axis), items (up to 4 quadrant labels)' },
  { name: 'solar-system', describe: 'planets at their own distances and speeds', uses: 'count (3-6 planets)' },
  { name: 'moon-phases', describe: 'the moon lit from one side as it goes round', uses: 'count (4-8 phases shown)' },
  { name: 'seasons', describe: 'a tilted earth at two points in its orbit', uses: 'labelA (first season), labelB (second season)' },
  { name: 'water-cycle', describe: 'evaporation, cloud and rain going round', uses: 'no parameters' },
  { name: 'earth-layers', describe: 'the crust, mantle and core as shells', uses: 'items (up to 4 layer labels)' },
  { name: 'plate-tectonics', describe: 'two plates meeting and pushing up a range', uses: 'mode ("collide", "spread" or "slide")' },
  { name: 'flowchart', describe: 'boxes joined by arrows, left to right', uses: 'items (2-5 steps, each with a label)' },
  { name: 'cycle', describe: 'steps going round and returning to the start', uses: 'items (3-6 steps, each with a label)' },
  { name: 'pyramid', describe: 'levels stacked from a wide base to a narrow top', uses: 'items (3-5 levels, top first)' },
  { name: 'before-after', describe: 'two states side by side with an arrow between', uses: 'labelA (before), labelB (after), items (up to 3 changes)' },
  { name: 'checklist', describe: 'points ticked off one at a time', uses: 'items (2-5 points, each with a label)' },
  { name: 'scale-balance', describe: 'two sides of a scale tipping towards the heavier', uses: 'items (2 sides, each with a label and a value)' },
];

export const SKETCH_NAMES = SKETCH_CATALOGUE.map((s) => s.name);

/**
 * The lines describing the library inside the generation prompt.
 *
 * Deliberately two lines per sketch and not three. At a hundred entries the old
 * three-line form was three hundred lines of every request, most of it repeating
 * the sketch's own name back at the model.
 */
export function sketchPromptLines() {
  const lines = [
    'ANIMATED SKETCHES. Setting visual.kind to "sketch" runs a real animation, drawn live.',
    'Set "sketch" to one of these names and put its knobs in "params". Never invent a name.',
    'Prefer a sketch over a static diagram whenever the point is about MOVEMENT or CHANGE.',
    'Pick the one that actually shows THIS scene\'s idea. A diagram that is merely in the right',
    'subject is worse than none: it looks like an illustration of something else.',
    'Do not use the same sketch twice in one video unless the second use shows a different case.',
  ];
  for (const s of SKETCH_CATALOGUE) {
    lines.push('- ' + s.name + ': ' + s.describe);
    lines.push('    params: ' + s.uses);
  }
  lines.push('Leave out any parameter you are unsure of; every one has a sensible default.');
  return lines;
}

/**
 * Guards against this file being stale. The test calls it; so does boot.
 * Returns the names the catalogue is missing, which is always empty unless
 * somebody added a sketch and forgot to regenerate.
 */
export function verifyAgainstImplementations(names) {
  const have = new Set(SKETCH_NAMES);
  return (names || []).filter((n) => !have.has(n));
}
