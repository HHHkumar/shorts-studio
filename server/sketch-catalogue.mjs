// ---------------------------------------------------------------------------
// What Gemini is told about the animation library.
//
// The implementations live in src/remotion/sketches.ts, which the server cannot
// import (it is TypeScript). The names here MUST match the keys there - run
// `node server/sketch-catalogue.mjs` to check, which is also done on boot.
// ---------------------------------------------------------------------------

export const SKETCH_CATALOGUE = [
  {
    name: 'wave-interference',
    describe: 'two sources sending out ripples that add and cancel',
    when: 'interference, sound, water waves, the double slit',
    uses: 'frequency (1-5, ripple tightness), speed (1-5)',
  },
  {
    name: 'sine-wave',
    describe: 'one or two sine waves travelling across the screen, with their sum',
    when: 'waves, sound, oscillation, superposition',
    uses: 'frequency (1-6), amplitude (0.2-1), count (1, or 2 to add a second wave and their sum)',
  },
  {
    name: 'orbit',
    describe: 'bodies circling a central mass at different periods',
    when: 'planets, moons, satellites, orbital periods',
    uses: 'count (1-3 orbiting bodies), ratio (0.3-3, how much slower each outer body is), labelA (centre), labelB (first orbiter)',
  },
  {
    name: 'projectile',
    describe: 'a ball launched at an angle, tracing its arc as the scene plays',
    when: 'projectile motion, range, trajectory, gravity',
    uses: 'angle (15-75 degrees), speed (1-5)',
  },
  {
    name: 'pendulum',
    describe: 'a bob swinging on a string, with its swept arc drawn',
    when: 'periodic motion, period and length, energy conversion',
    uses: 'amplitude (10-60 degrees), speed (0.5-3)',
  },
  {
    name: 'vector-field',
    describe: 'a grid of arrows showing the direction of a field',
    when: 'gravity, electric and magnetic fields, fluid flow',
    uses: 'mode ("radial" for a point source, "rotational" for a curl, "uniform" for a constant field)',
  },
  {
    name: 'particles',
    describe: 'particles scattering outwards from a point as the scene plays',
    when: 'diffusion, gases, entropy, Brownian motion, radiation',
    uses: 'count (20-120), speed (0.5-2)',
  },
  {
    name: 'graph',
    describe: 'a curve drawn on axes, revealed left to right',
    when: 'showing how one quantity depends on another',
    uses: 'mode ("linear", "quadratic", "cubic", "exponential", "inverse-square", "sine", "log"), labelA (x axis), labelB (y axis)',
  },
  {
    name: 'atom',
    describe: 'a nucleus with electrons circling in shells',
    when: 'atomic structure, electron shells, isotopes, bonding',
    uses: 'count (1-3 shells), amplitude (1-8 electrons on the outer shell), labelA (element symbol)',
  },
  {
    name: 'refraction',
    describe: 'a light ray bending as it crosses a boundary between two media',
    when: 'refraction, lenses, Snell’s law, why a straw looks bent',
    uses: 'angle (10-70 degrees of incidence), ratio (1.1-2.4 refractive index), labelA / labelB (the two media)',
  },
];

export const SKETCH_NAMES = SKETCH_CATALOGUE.map((s) => s.name);

/** The lines describing the library inside the system prompt. */
export function sketchPromptLines() {
  const lines = [
    'ANIMATED SKETCHES. Setting visual.kind to "sketch" runs a real animation, drawn live.',
    'Set "sketch" to one of these names and put its knobs in "params". Never invent a name.',
    'Prefer a sketch over a static diagram whenever the point is about MOVEMENT or CHANGE.',
  ];
  for (const s of SKETCH_CATALOGUE) {
    lines.push('- ' + s.name + ': ' + s.describe + '.');
    lines.push('    use for: ' + s.when);
    lines.push('    params: ' + s.uses);
  }
  lines.push('Leave out any parameter you are unsure of; every one has a sensible default.');
  return lines;
}

/**
 * Guards against this file drifting from the implementations. Reads the TS
 * source and checks every catalogued name has a matching key.
 */
export function verifyAgainstImplementations(sketchesTsSource) {
  const missing = SKETCH_NAMES.filter((name) => {
    // Keys are written either bare (orbit:) or quoted ('wave-interference':).
    return !(
      sketchesTsSource.includes('\n  ' + name + ': {') ||
      sketchesTsSource.includes("\n  '" + name + "': {")
    );
  });
  return missing;
}
