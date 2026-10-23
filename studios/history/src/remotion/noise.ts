/** Deterministic 0..1 from an integer, so the same speck is in the same place on every render. */
export function hash(n: number): number {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/** A wobbly closed outline around (cx, cy): the edge of an ink blot, a hand-drawn ring. */
export function blob(cx: number, cy: number, rx: number, ry: number, seed: number, roughness = 0.12, points = 48): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2;
    const wob = 1 + roughness * (Math.sin(a * 3 + seed) * 0.5 + Math.sin(a * 7 + seed * 2.3) * 0.3 + (hash(seed * 97 + i) - 0.5) * 0.4);
    out.push([cx + Math.cos(a) * rx * wob, cy + Math.sin(a) * ry * wob]);
  }
  return out;
}
