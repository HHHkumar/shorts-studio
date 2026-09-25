import React, { useEffect, useState } from 'react';
import { continueRender, delayRender, staticFile } from 'remotion';

// ---------------------------------------------------------------------------
// The handwritten font for the Doodle look.
//
// Every other look uses fonts already on the machine, precisely so the render
// never has to wait for one. Kalam is the exception, so it is self-hosted in
// public/fonts and the render is held with delayRender until it has loaded -
// the alternative is some frames captured in the fallback and some in Kalam,
// which reads as the words flickering.
//
// If it fails to load the render continues in the fallback stack rather than
// timing out: a video in the wrong font is a problem, no video is a worse one.
// ---------------------------------------------------------------------------

const FACES = [
  { weight: '400', file: 'fonts/kalam-400.woff2' },
  { weight: '700', file: 'fonts/kalam-700.woff2' },
];

/** Loaded once per page, however many scenes or frames ask. */
let loading: Promise<void> | null = null;

function loadHandFont(): Promise<void> {
  if (loading) return loading;
  if (typeof FontFace === 'undefined' || typeof document === 'undefined') return Promise.resolve();
  loading = Promise.all(
    FACES.map(async ({ weight, file }) => {
      const face = new FontFace('Kalam', 'url(' + staticFile(file) + ") format('woff2')", {
        weight,
        style: 'normal',
      });
      await face.load();
      document.fonts.add(face);
    }),
  ).then(() => undefined);
  return loading;
}

/**
 * Resolves once the handwritten font is usable - starting the load if nothing
 * has yet, so a caller never depends on which component asked first.
 *
 * For canvases. Text on the page re-renders by itself when a font arrives; a
 * canvas does not - whatever it drew with is baked in - so a sketch drawn a
 * moment too early kept its labels in the fallback for good.
 */
export function handFontReady(): Promise<void> {
  return loadHandFont().catch(() => undefined);
}

/** Mount once in a Doodle video. Renders nothing; holds the render until the font is in. */
export const HandFonts: React.FC = () => {
  const [handle] = useState(() => delayRender('Loading the handwritten font'));
  useEffect(() => {
    loadHandFont()
      .catch((err) => {
        console.warn('Kalam did not load; the Doodle look falls back to the system font.', err);
      })
      .finally(() => continueRender(handle));
  }, [handle]);
  return null;
};
