// ---------------------------------------------------------------------------
// A junction: currents meeting at one node. The Kirchhoff's current law figure.
//
// The model gives every branch with its TRUE current, and marks the one being
// asked for as unknown. Conservation of charge is then checked here rather
// than trusted: if what goes in does not equal what comes out, the question
// itself is wrong, and no figure is drawn for it.
// ---------------------------------------------------------------------------

import { formatQuantity, sameValue } from './quantity.ts';

export interface Branch {
  label: string;
  /** Amperes, always positive. The direction says which way it flows. */
  value: number;
  direction: 'in' | 'out';
  unknown: boolean;
}

export interface Junction {
  type: 'junction';
  title: string;
  branches: Branch[];
}

const str = (v: unknown, max = 24): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export function normalizeJunction(raw: any): { junction: Junction | null; errors: string[] } {
  const errors: string[] = [];
  const r = raw && typeof raw === 'object' ? raw : {};
  const branches: Branch[] = [];
  const list = Array.isArray(r.branches) ? r.branches : [];

  list.forEach((b: any, i: number) => {
    const direction = b && (b.direction === 'in' || b.direction === 'out') ? b.direction : null;
    const label = str(b && b.label, 8) || 'I' + (i + 1);
    let value = Number(b && b.value);
    // Milliamperes are common in these questions; everything here is amperes.
    const unit = str(b && b.unit, 4);
    if (/^mA$/i.test(unit) && unit[0] === 'm') value /= 1000;
    else if (unit && !/^A$/i.test(unit)) { errors.push(label + ' is not in amperes'); return; }
    if (!direction) { errors.push(label + ' has no direction'); return; }
    if (!Number.isFinite(value) || value < 0) { errors.push(label + ' has no usable current'); return; }
    branches.push({ label, value, direction, unknown: Boolean(b && b.unknown) });
  });

  if (branches.length < 3 || branches.length > 6) errors.push('a junction needs 3 to 6 branches');
  if (branches.filter((b) => b.unknown).length > 1) errors.push('only one branch can be the unknown');
  if (!branches.some((b) => b.direction === 'in') || !branches.some((b) => b.direction === 'out')) {
    errors.push('current must both enter and leave the junction');
  }

  const inflow = branches.filter((b) => b.direction === 'in').reduce((s, b) => s + b.value, 0);
  const outflow = branches.filter((b) => b.direction === 'out').reduce((s, b) => s + b.value, 0);
  if (branches.length && !sameValue(inflow, outflow)) {
    errors.push('currents do not balance: ' + formatQuantity(inflow, 'A') + ' in, ' + formatQuantity(outflow, 'A') + ' out');
  }

  const junction: Junction = { type: 'junction', title: str(r.title, 60), branches };
  return { junction: errors.length ? null : junction, errors };
}

/** The unknown branch's current, worked out from the others - not read back from the model. */
export function answerJunction(j: Junction): { value: number; unit: 'A' } | null {
  const unknown = j.branches.find((b) => b.unknown);
  if (!unknown) return null;
  let net = 0;
  for (const b of j.branches) {
    if (b === unknown) continue;
    net += b.direction === 'in' ? b.value : -b.value;
  }
  // What the known branches leave unbalanced must flow out through the unknown
  // one if it leaves, or in if it enters. The other sign is a contradiction.
  const value = unknown.direction === 'out' ? net : -net;
  return value >= 0 ? { value, unit: 'A' } : null;
}

export function branchText(b: Branch, reveal: boolean): string {
  return b.label + ' = ' + (b.unknown && !reveal ? '?' : formatQuantity(b.value, 'A'));
}

export interface PlacedBranch {
  branch: Branch;
  /** The far end of the branch. The node is at the centre. */
  x: number;
  y: number;
  angle: number;
}

/**
 * Entering branches fan out on the left, leaving ones on the right, so the
 * picture reads left to right the way the sentence does.
 */
export function layoutJunction(j: Junction, width: number, height: number) {
  const cx = width / 2;
  const cy = height / 2;
  const length = Math.min(width * 0.3, height * 0.4, 300);
  const place = (list: Branch[], centre: number): PlacedBranch[] => {
    const spread = list.length === 1 ? 0 : Math.min(110, 50 * (list.length - 1));
    return list.map((branch, i) => {
      const deg = centre - spread / 2 + (list.length === 1 ? 0 : (spread * i) / (list.length - 1));
      const angle = (deg * Math.PI) / 180;
      return { branch, angle, x: cx + Math.cos(angle) * length, y: cy + Math.sin(angle) * length };
    });
  };
  const ins = j.branches.filter((b) => b.direction === 'in');
  const outs = j.branches.filter((b) => b.direction === 'out');
  return { cx, cy, length, branches: [...place(ins, 180), ...place(outs, 0)] };
}
