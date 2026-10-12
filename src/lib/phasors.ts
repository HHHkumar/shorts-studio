// ---------------------------------------------------------------------------
// A phasor diagram that adds up.
//
// A line's receiving-end voltage, the drop across its reactance and its
// sending-end voltage are three arrows, and the whole point of drawing them is
// that the third is the sum of the first two. The sketch that used to stand in
// for this took one angle and two labels: asked for a drop at 180 degrees to
// the voltage, it drew three short arrows on top of each other with their
// labels overlapping, and no way to tell which was the resultant.
//
// Here each phasor is given its own length and angle. They can be drawn from
// one point, or added head to tail - and when they are added, the last one is
// CHECKED against the sum of the others before anything is drawn. A diagram
// whose resultant is not the resultant is not a phasor diagram.
//
// Lengths are relative: nothing prints them. Angles are what the picture
// states, so those are what must be right.
//
// Pure arithmetic. The server imports this directly, so every import keeps
// its .ts extension.
// ---------------------------------------------------------------------------

export interface Phasor {
  label: string;
  /** Relative to the others; never printed. */
  length: number;
  /** Degrees, anticlockwise from the horizontal. */
  angle: number;
}

export type PhasorMode = 'fan' | 'sum';

const number = (v: unknown): number => {
  if (typeof v === 'number') return v;
  const text = String(v ?? '').replace(/−/g, '-').replace(/[^0-9.+-]/g, '');
  return text === '' || text === '-' || text === '+' ? NaN : Number(text);
};

/** The phasors a sketch was given: each item's value is its length, its symbol its angle. */
export function readPhasors(items: unknown): Phasor[] {
  return (Array.isArray(items) ? items : []).slice(0, 4).map((it: any) => ({
    label: String((it && it.label) ?? '').trim().slice(0, 12),
    length: Number(it && it.value),
    angle: number(it && it.symbol),
  }));
}

const rad = (deg: number) => (deg * Math.PI) / 180;

/** The sum of some phasors, as a length and an angle between -180 and 180. */
export function phasorSum(list: Phasor[]): { length: number; angle: number } {
  const x = list.reduce((s, p) => s + p.length * Math.cos(rad(p.angle)), 0);
  const y = list.reduce((s, p) => s + p.length * Math.sin(rad(p.angle)), 0);
  const length = Math.hypot(x, y);
  return { length, angle: length < 1e-9 ? 0 : (Math.atan2(y, x) * 180) / Math.PI };
}

const round = (n: number) => String(Math.round(n * 100) / 100);

/** The difference between two angles, the short way round. */
export const angleBetween = (a: number, b: number): number => {
  const d = (((a - b) % 360) + 540) % 360 - 180;
  return Math.abs(d);
};

/**
 * Why these phasors cannot be drawn, in words that finish the sentence
 * "The phasors ...". Empty when they can.
 */
export function phasorProblems(items: unknown, mode: unknown): string[] {
  const list = readPhasors(items);
  if (list.length < 2) return ['need at least two phasors'];
  const bad = list.find((p) => !p.label || !Number.isFinite(p.length) || !(p.length > 0) || !Number.isFinite(p.angle));
  if (bad) return ['need a name, a length and an angle for every phasor' + (bad.label ? ' - ' + bad.label + ' is missing one' : '')];
  if (String(mode ?? '').toLowerCase() !== 'sum') return [];

  if (list.length < 3) return ['need two phasors and their resultant to be added'];
  const parts = list.slice(0, -1);
  const claimed = list[list.length - 1];
  const sum = phasorSum(parts);
  const biggest = Math.max(...list.map((p) => p.length));
  // Within a twentieth of the longest arrow, and four degrees: as close as a drawing can show.
  const lengthOff = Math.abs(sum.length - claimed.length) > biggest * 0.05;
  const angleOff = sum.length > biggest * 0.05 && angleBetween(sum.angle, claimed.angle) > 4;
  if (lengthOff || angleOff) {
    return [claimed.label + ' is not the sum of ' + parts.map((p) => p.label).join(' and ') + ': that comes to a length of '
      + round(sum.length) + ' at ' + round(sum.angle) + ' degrees, not ' + round(claimed.length) + ' at ' + round(claimed.angle)];
  }
  return [];
}

/** The angles a diagram shows as a measurement, which the video must account for. */
export function phasorAngles(items: unknown): number[] {
  const list = readPhasors(items).filter((p) => Number.isFinite(p.angle));
  if (list.length < 2) return [];
  // Each one's angle to the first: that is what the eye reads off the drawing.
  return list.slice(1).map((p) => angleBetween(p.angle, list[0].angle));
}
