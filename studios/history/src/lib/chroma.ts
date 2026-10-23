// ---------------------------------------------------------------------------
// Green screen, in the browser.
//
// A character for a parallax layer is drawn on flat bright green. This turns
// the green transparent, softens the edge, removes the green tint that spills
// onto the outline, and crops to the character so its feet are the bottom of
// the image - which is what the layer's position means.
//
// Only green that touches the border is removed (a flood fill from the edges),
// so a green belt or leaf ON the character survives.
// ---------------------------------------------------------------------------

export interface CutOut {
  png: Blob;
  width: number;
  height: number;
  /** Fraction of the picture that was keyed out; near 0 means it was not on green. */
  removed: number;
}

/** How "green-screen green" a pixel is: 0 not at all, 1 fully. */
export function greenness(r: number, g: number, b: number): number {
  const lead = g - Math.max(r, b);
  if (g < 80 || lead < 30) return 0;
  return Math.max(0, Math.min(1, (lead - 30) / 70));
}

export function keyPixels(data: Uint8ClampedArray, w: number, h: number): number {
  const n = w * h;
  const green = new Float32Array(n);
  for (let i = 0; i < n; i++) green[i] = greenness(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);

  // Flood fill from the border through greenish pixels.
  const bg = new Uint8Array(n);
  const stack: number[] = [];
  const seed = (i: number) => {
    if (!bg[i] && green[i] > 0.25) {
      bg[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1); }
  while (stack.length) {
    const i = stack.pop() as number;
    const x = i % w;
    const y = (i - x) / w;
    if (x > 0) seed(i - 1);
    if (x < w - 1) seed(i + 1);
    if (y > 0) seed(i - w);
    if (y < h - 1) seed(i + w);
  }

  let removed = 0;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    if (bg[i]) {
      data[o + 3] = Math.round(255 * (1 - green[i]) * 0.15);
      if (green[i] > 0.6) data[o + 3] = 0;
      removed++;
      continue;
    }
    // Edge pixels next to the background: soften and take the green spill out.
    const x = i % w;
    const near = (x > 0 && bg[i - 1]) || (x < w - 1 && bg[i + 1]) || (i >= w && bg[i - w]) || (i < n - w && bg[i + w]);
    if (near || green[i] > 0) {
      const r = data[o];
      const b = data[o + 2];
      data[o + 1] = Math.min(data[o + 1], Math.max(r, b));
      if (near) data[o + 3] = Math.round(data[o + 3] * (1 - green[i] * 0.8));
    }
  }
  return removed / n;
}

function bounds(data: Uint8ClampedArray, w: number, h: number) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 24) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? { x0: 0, y0: 0, x1: w - 1, y1: h - 1 } : { x0, y0, x1, y1 };
}

export async function cutOutGreen(url: string): Promise<CutOut> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = url;
  await img.decode();
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('This browser cannot process images.');
  ctx.drawImage(img, 0, 0);
  const pixels = ctx.getImageData(0, 0, w, h);
  const removed = keyPixels(pixels.data, w, h);
  ctx.putImageData(pixels, 0, 0);

  const b = bounds(pixels.data, w, h);
  const cw = b.x1 - b.x0 + 1;
  const ch = b.y1 - b.y0 + 1;
  const out = document.createElement('canvas');
  out.width = cw;
  out.height = ch;
  out.getContext('2d')?.drawImage(canvas, b.x0, b.y0, cw, ch, 0, 0, cw, ch);
  const png = await new Promise<Blob>((resolve, reject) => out.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not save the cut-out.'))), 'image/png'));
  return { png, width: cw, height: ch, removed };
}
