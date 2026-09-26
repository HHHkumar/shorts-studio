// ---------------------------------------------------------------------------
// Which scenes a voiceover job records.
//
// Every scene with words, normally. With `only`, just those scene numbers -
// the ones whose words were edited after the voiceover was made, so fixing a
// fun fact costs one scene's credits rather than the whole video's. The whole
// script is still sent either way, so each clip keeps its scene's number and
// drops back in beside the clips already made.
// ---------------------------------------------------------------------------

/** The scene numbers to record, in order. */
export function scenesToRecord(script, only) {
  const lines = Array.isArray(script) ? script : [];
  const wanted = Array.isArray(only) && only.length
    ? new Set(only.map(Number).filter((n) => Number.isInteger(n) && n >= 0))
    : null;
  const out = [];
  lines.forEach((line, i) => {
    if (wanted && !wanted.has(i)) return;
    if (!String((line && line.narration) || '').trim()) return;
    out.push(i);
  });
  return out;
}
