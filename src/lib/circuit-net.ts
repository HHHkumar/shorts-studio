// ---------------------------------------------------------------------------
// Any series-parallel network, from one short string.
//
// The circuit sketch used to take a `mode`: "series" or "parallel". That is two
// of the shapes a question can describe, and questions describe many more - two
// in parallel wired in series with a third, two in series wired in parallel
// with a third, a ladder, a divider feeding a load. Adding a mode per shape is
// a losing race: there is always another arrangement, and until it is added the
// model picks the nearest wrong one and draws a circuit that contradicts the
// words beside it.
//
// So the storyboard writes the network instead of naming a shape:
//
//     12 + (12 | 12)      one in series with two in parallel
//     (12 + 12) | 12      two in series, in parallel with a third
//     4 | 4 | 4           three in parallel
//     R1 + R2 | R3        parallel binds tighter, as it does on paper
//
// A string rather than a nested object because the response schema cannot
// express recursion - Gemini's structured output has no $ref - and because a
// model writes a short infix expression more reliably than deep JSON.
//
// Every arrangement these questions use reduces to series and parallel, so this
// covers the set rather than a sample of it. A bridge does not reduce, and is a
// different figure with a different name.
// ---------------------------------------------------------------------------

export type Net =
  | { kind: 'leaf'; label: string }
  | { kind: 'series'; kids: Net[] }
  | { kind: 'parallel'; kids: Net[] };

/** One component, placed. */
export interface NetBox {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
}

/** A straight wire. */
export interface NetWire {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface NetLayout {
  boxes: NetBox[];
  wires: NetWire[];
  /** Junctions, so a meeting of wires reads as joined and not as a crossing. */
  dots: { x: number; y: number }[];
  /** Chosen to fit, so the caller can size its labels to match. */
  boxH: number;
  /** How far above a box its label should sit, clear of the box above it. */
  labelGap: number;
}

// --- reading the string -----------------------------------------------------

/**
 * Parse `12 + (12 | 12)` into a tree.
 *
 * Parallel binds tighter than series, which is how it is written on paper:
 * `R1 + R2 | R3` is R1 in series with the pair. Returns null on anything it
 * cannot read, so a caller can fall back rather than draw nonsense.
 */
export function parseNet(text: string): Net | null {
  const src = String(text || '').trim();
  if (!src) return null;

  let at = 0;
  const skip = () => { while (at < src.length && /\s/.test(src[at])) at++; };

  // series := parallel ('+' parallel)*
  const series = (): Net | null => {
    const kids: Net[] = [];
    for (;;) {
      const kid = parallel();
      if (!kid) return null;
      kids.push(kid);
      skip();
      if (src[at] !== '+') break;
      at++;
    }
    return kids.length === 1 ? kids[0] : { kind: 'series', kids };
  };

  // parallel := factor ('|' factor)*
  const parallel = (): Net | null => {
    const kids: Net[] = [];
    for (;;) {
      const kid = factor();
      if (!kid) return null;
      kids.push(kid);
      skip();
      // Accept the doubled form too: a model writing `||` means the same thing.
      if (src[at] !== '|') break;
      at++;
      if (src[at] === '|') at++;
    }
    return kids.length === 1 ? kids[0] : { kind: 'parallel', kids };
  };

  const factor = (): Net | null => {
    skip();
    if (src[at] === '(') {
      at++;
      const inner = series();
      skip();
      if (src[at] !== ')') return null;
      at++;
      return inner;
    }
    // A leaf runs to the next operator or bracket. Anything else is its label,
    // so "4.7k ohm" and "R1" both survive intact.
    const start = at;
    while (at < src.length && !'+|()'.includes(src[at])) at++;
    const label = src.slice(start, at).trim();
    return label ? { kind: 'leaf', label } : null;
  };

  const tree = series();
  skip();
  // Trailing junk means it was misread, not read.
  return tree && at >= src.length ? tree : null;
}

/** How many components are in it. Used to sanity-check against the question. */
export function countLeaves(net: Net): number {
  return net.kind === 'leaf' ? 1 : net.kids.reduce((n, k) => n + countLeaves(k), 0);
}

// --- placing it -------------------------------------------------------------

/** Size in grid cells: series grows across, parallel grows down. */
function measure(net: Net): { w: number; h: number } {
  if (net.kind === 'leaf') return { w: 1, h: 1 };
  const kids = net.kids.map(measure);
  return net.kind === 'series'
    ? { w: kids.reduce((n, k) => n + k.w, 0), h: Math.max(...kids.map((k) => k.h)) }
    : { w: Math.max(...kids.map((k) => k.w)), h: kids.reduce((n, k) => n + k.h, 0) };
}

/**
 * Place a network inside a rectangle.
 *
 * Every branch enters at the left edge, mid-height, and leaves at the right
 * edge, mid-height - which is what lets the same routine nest inside itself
 * without either side knowing what the other contains.
 */
export function layoutNet(
  net: Net,
  x: number,
  y: number,
  w: number,
  h: number,
  maxBoxW = 84,
  maxBoxH = 32,
): NetLayout {
  // Components are sized to the room the network leaves them, not to a fixed
  // number. Three branches stacked in the space one resistor had were drawn at
  // full size with their labels overlapping the box above; the topology was
  // right and unreadable, which is only half a fix.
  const cells = measure(net);
  const boxH = Math.max(11, Math.min(maxBoxH, (h / cells.h) * 0.4));
  const boxW = Math.max(38, Math.min(maxBoxW, (w / cells.w) * 0.52));
  // Enough to clear the box and its stroke, and no more - on a dense network
  // the gap is most of what is left.
  const labelGap = boxH * 0.6 + 12;

  const out: NetLayout = { boxes: [], wires: [], dots: [], boxH, labelGap };

  const place = (node: Net, left: number, top: number, width: number, height: number) => {
    const midY = top + height / 2;

    if (node.kind === 'leaf') {
      const bw = Math.min(boxW, width * 0.72);
      const cx = left + width / 2;
      out.boxes.push({ x: cx - bw / 2, y: midY - boxH / 2, w: bw, h: boxH, label: node.label });
      // Leads either side, so a chain of leaves joins up without anyone
      // co-ordinating it.
      out.wires.push({ x1: left, y1: midY, x2: cx - bw / 2, y2: midY });
      out.wires.push({ x1: cx + bw / 2, y1: midY, x2: left + width, y2: midY });
      return;
    }

    const sizes = node.kids.map(measure);

    if (node.kind === 'series') {
      // Width shared out by how much each child needs, so a nested pair is not
      // squeezed into the same span as a single resistor beside it.
      const total = sizes.reduce((n, s) => n + s.w, 0) || 1;
      let cursor = left;
      node.kids.forEach((kid, i) => {
        const kw = (width * sizes[i].w) / total;
        place(kid, cursor, top, kw, height);
        cursor += kw;
      });
      return;
    }

    // Parallel: children stacked, each spanning the full width, joined by a
    // vertical bus at each end.
    const total = sizes.reduce((n, s) => n + s.h, 0) || 1;
    let cursor = top;
    const centres: number[] = [];
    node.kids.forEach((kid, i) => {
      const kh = (height * sizes[i].h) / total;
      place(kid, left, cursor, width, kh);
      centres.push(cursor + kh / 2);
      cursor += kh;
    });

    const first = Math.min(...centres);
    const last = Math.max(...centres);
    out.wires.push({ x1: left, y1: first, x2: left, y2: last });
    out.wires.push({ x1: left + width, y1: first, x2: left + width, y2: last });
    // The branch as a whole is entered at mid-height, so the bus has to reach
    // there even when no child sits on that line.
    if (midY < first || midY > last) {
      out.wires.push({ x1: left, y1: midY, x2: left, y2: midY < first ? first : last });
      out.wires.push({ x1: left + width, y1: midY, x2: left + width, y2: midY < first ? first : last });
    }
    out.dots.push({ x: left, y: midY }, { x: left + width, y: midY });
  };

  place(net, x, y, w, h);
  return out;
}
