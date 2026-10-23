import { staticFile } from 'remotion';

/** A public/-relative path (or a full URL) as something <Img>, <Audio> and <OffthreadVideo> can load. */
export function resolveSrc(src: string): string {
  if (/^(https?:|blob:|data:)/i.test(src)) return src;
  return staticFile(src.replace(/^\/+/, ''));
}
