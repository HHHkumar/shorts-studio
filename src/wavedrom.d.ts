// WaveDrom ships no type declarations. These cover the part this app uses:
// render a WaveJSON source to an element tree, and the tree to SVG text.
declare module 'wavedrom' {
  const wavedrom: {
    renderAny(index: number, source: object, skins: Record<string, unknown>): unknown;
    waveSkin: Record<string, unknown>;
    onml: { stringify(tree: unknown): string };
  };
  export default wavedrom;
}

declare module 'wavedrom/skins/dark.js' {
  const skins: Record<string, unknown>;
  export default skins;
}
