import React from 'react';
import { AbsoluteFill, Audio, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import {
  buildTimeline,
  GROUPS,
  LETTERS,
  lettersBefore,
  segmentAt,
  type Clips,
  type GroupId,
  type Segment,
} from '../lib/varnamale';

// ---------------------------------------------------------------------------
// The Kannada alphabet, 16:9: the whole varnamale on one chart, each letter
// lighting up while the voice says it, with the current letter large on the
// right.
//
// The chart is always all there. A learner should see where a letter sits
// among the rest, so nothing slides in; letters only change state:
//
//   still to come  - faint
//   being said     - filled with its group's colour, lifted
//   already said   - full ink, tinted border in its group's colour
//
// Timing comes entirely from buildTimeline() in src/lib/varnamale.ts.
// ---------------------------------------------------------------------------

export const VARNAMALE_ID = 'Varnamale';

// A type, not an interface: Remotion wants props it can treat as a plain record.
export type VarnamaleProps = {
  /** Recorded voice, by clip id. Null renders silent at fixed timings. */
  clips: Clips | null;
  /** The calm music bed under the voice, very low. */
  music: boolean;
};

// Kannada needs a face that has it; the Latin faces in theme.ts carry none.
// Nirmala UI ships with Windows, Tunga with the Indic language pack.
const KANNADA = "'Nirmala UI', Tunga, 'Noto Sans Kannada', sans-serif";
const LATIN = "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

const C = {
  bg: '#FFF8EE',
  card: '#FFFFFF',
  line: '#EBDCC6',
  ink: '#2B2140',
  dim: '#B9AE9F',
  faint: '#D9CEBF',
  sub: '#7A6E62',
};

// --- where each letter sits ----------------------------------------------------

const CELL = 92;
const STEP = 104;
const TOP = 176;
const HEAD = 52;
const SUBHEAD = 44;
const LEFT_X = 84;
const RIGHT_X = LEFT_X + 4 * STEP + 56;

interface Cell {
  x: number;
  y: number;
}

/**
 * Vowels in rows of four with the two yogavahas under them; consonants one
 * varga to a row, the ungrouped nine in rows of five beneath. The way school
 * charts print it.
 */
function layout(): { cells: Cell[]; subheads: { group: GroupId; x: number; y: number }[] } {
  const cells: Cell[] = [];
  const subheads: { group: GroupId; x: number; y: number }[] = [];
  const counts: Partial<Record<GroupId, number>> = {};
  const vargas: GroupId[] = ['ka', 'cha', 'tta', 'ta', 'pa'];
  for (const letter of LETTERS) {
    const n = (counts[letter.group] = (counts[letter.group] ?? -1) + 1);
    const g = letter.group;
    if (g === 'svara') {
      cells.push({ x: LEFT_X + (n % 4) * STEP, y: TOP + HEAD + Math.floor(n / 4) * STEP });
    } else if (g === 'yogavaha') {
      const y = TOP + HEAD + 4 * STEP + SUBHEAD;
      if (n === 0) subheads.push({ group: g, x: LEFT_X, y: y - SUBHEAD });
      cells.push({ x: LEFT_X + n * STEP, y });
    } else if (g === 'avargiya') {
      const y = TOP + HEAD + 5 * STEP + SUBHEAD + Math.floor(n / 5) * STEP;
      if (n === 0) subheads.push({ group: g, x: RIGHT_X, y: y - SUBHEAD });
      cells.push({ x: RIGHT_X + (n % 5) * STEP, y });
    } else {
      cells.push({ x: RIGHT_X + n * STEP, y: TOP + HEAD + vargas.indexOf(g) * STEP });
    }
  }
  return { cells, subheads };
}

const LAYOUT = layout();

// --- the pieces ------------------------------------------------------------------

const LetterCell: React.FC<{ index: number; done: boolean; current: boolean; since: number; outroWave: number }> = ({
  index, done, current, since, outroWave,
}) => {
  const { fps } = useVideoConfig();
  const letter = LETTERS[index];
  const { x, y } = LAYOUT.cells[index];
  const colour = GROUPS[letter.group].colour;

  // The lift on the beat it is said, settling back as the next one starts.
  const lift = current ? spring({ frame: since, fps, config: { damping: 11, stiffness: 160 } }) : 0;
  const scale = 1 + 0.14 * lift + 0.08 * outroWave;

  const fill = current ? colour : C.card;
  const border = current ? colour : done ? colour : C.line;
  const ink = current ? '#FFFFFF' : done ? C.ink : C.faint;
  const sub = current ? 'rgba(255,255,255,0.85)' : done ? C.sub : C.faint;

  return (
    <div
      style={{
        position: 'absolute', left: x, top: y, width: CELL, height: CELL,
        borderRadius: 18, background: fill, border: '3px solid ' + border,
        boxSizing: 'border-box', transform: 'scale(' + scale + ')',
        boxShadow: current ? '0 10px 28px ' + colour + '66' : done ? '0 2px 0 ' + colour + '33' : 'none',
        zIndex: current ? 2 : 1,
      }}
    >
      {/* The glyph sits high and the romanisation is pinned to the bottom:
          the aspirates (ಘ ಛ ಢ ಧ ಭ) hang a mark below the line that ran into
          a label set directly underneath. */}
      <div
        style={{
          position: 'absolute', left: 0, right: 0, top: 0, height: 60,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: KANNADA, fontSize: letter.glyph.length > 1 ? 38 : 46, fontWeight: 600, lineHeight: 1, color: ink,
        }}
      >
        {letter.glyph}
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 4, textAlign: 'center', fontFamily: LATIN, fontSize: 16, fontWeight: 600, color: sub }}>
        {letter.roman}
      </div>
    </div>
  );
};

const Heading: React.FC<{ x: number; y: number; kannada: string; english: string; lit: boolean; colour: string }> = ({
  x, y, kannada, english, lit, colour,
}) => (
  <div style={{ position: 'absolute', left: x, top: y, display: 'flex', alignItems: 'baseline', gap: 14, whiteSpace: 'nowrap' }}>
    <span style={{ fontFamily: KANNADA, fontSize: 30, fontWeight: 700, color: lit ? colour : C.ink }}>{kannada}</span>
    <span style={{ fontFamily: LATIN, fontSize: 20, fontWeight: 600, color: C.sub, letterSpacing: 0.5 }}>{english}</span>
  </div>
);

/** The right-hand card: the letter being said, large, or the heading being read. */
const Spotlight: React.FC<{ seg: Segment; since: number }> = ({ seg, since }) => {
  const { fps } = useVideoConfig();
  const pop = spring({ frame: since, fps, config: { damping: 13, stiffness: 140 } });
  const x = 1250;
  const width = 1920 - x - 84;

  let body: React.ReactNode;
  let colour = C.ink;
  if (seg.kind === 'letter') {
    const letter = LETTERS[seg.letter];
    const group = GROUPS[letter.group];
    colour = group.colour;
    body = (
      <>
        <div style={{ fontFamily: KANNADA, fontSize: letter.glyph.length > 1 ? 250 : 330, fontWeight: 600, lineHeight: 1.1, color: colour }}>{letter.glyph}</div>
        <div style={{ fontFamily: LATIN, fontSize: 72, fontWeight: 700, color: C.ink, marginTop: 4 }}>{letter.roman}</div>
        <div style={{ fontFamily: KANNADA, fontSize: 32, fontWeight: 700, color: colour, marginTop: 36 }}>{group.kannada}</div>
        <div style={{ fontFamily: LATIN, fontSize: 22, fontWeight: 600, color: C.sub, marginTop: 6 }}>{group.english}</div>
      </>
    );
  } else {
    const group = seg.section ? GROUPS[seg.section] : null;
    colour = group ? group.colour : '#E8833A';
    const english =
      seg.kind === 'title' ? 'The Kannada alphabet'
      : seg.kind === 'outro' ? '49 letters'
      : seg.section === 'ka' ? 'Grouped consonants'
      : group?.english ?? '';
    // The closing sentence is too long for the card; the voice says it, the
    // card shows its point - forty-nine, in Kannada numerals.
    const shown = seg.kind === 'outro' ? '೪೯ ಅಕ್ಷರಗಳು' : seg.text;
    body = (
      <>
        <div style={{ fontFamily: KANNADA, fontSize: 84, fontWeight: 700, lineHeight: 1.35, color: colour, textAlign: 'center' }}>
          {shown}
        </div>
        <div style={{ fontFamily: LATIN, fontSize: 34, fontWeight: 600, color: C.sub, marginTop: 20 }}>{english}</div>
      </>
    );
  }

  return (
    <div
      style={{
        position: 'absolute', left: x, top: TOP, width, height: 1080 - TOP - 110,
        borderRadius: 36, background: C.card, border: '3px solid ' + C.line,
        boxShadow: '0 18px 40px rgba(80, 60, 30, 0.10)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 40, boxSizing: 'border-box', overflow: 'hidden',
      }}
    >
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 12, background: colour }} />
      <div
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          opacity: interpolate(pop, [0, 1], [0, 1]),
          transform: 'scale(' + interpolate(pop, [0, 1], [0.86, 1]) + ')',
        }}
      >
        {body}
      </div>
    </div>
  );
};

// --- the video -------------------------------------------------------------------

export const Varnamale: React.FC<VarnamaleProps> = ({ clips, music }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const timeline = React.useMemo(() => buildTimeline(clips, fps), [clips, fps]);

  const seg = segmentAt(timeline, frame);
  const since = frame - seg.from;
  const said = lettersBefore(timeline, frame);
  const current = seg.kind === 'letter' ? seg.letter : -1;

  // The finale: a ripple across the whole chart, letter by letter.
  const outroWave = (i: number) => {
    if (seg.kind !== 'outro') return 0;
    const t = since - i * 1.2;
    return t > 0 && t < 14 ? Math.sin((t / 14) * Math.PI) : 0;
  };

  const sectionLit = (g: GroupId) => seg.kind === 'section' && seg.section === g;
  const vyanjanaLit = seg.kind === 'section' && seg.section === 'ka';
  const fadeOut = interpolate(frame, [durationInFrames - 18, durationInFrames - 1], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <AbsoluteFill style={{ opacity: fadeOut }}>
        {/* Title bar */}
        <div style={{ position: 'absolute', left: LEFT_X, top: 56, display: 'flex', alignItems: 'baseline', gap: 24 }}>
          <span style={{ fontFamily: KANNADA, fontSize: 64, fontWeight: 800, color: C.ink }}>ಕನ್ನಡ ವರ್ಣಮಾಲೆ</span>
          <span style={{ fontFamily: LATIN, fontSize: 30, fontWeight: 600, color: C.sub }}>Kannada Alphabet</span>
        </div>
        <div style={{ position: 'absolute', right: 84, top: 82, fontFamily: LATIN, fontSize: 30, fontWeight: 700, color: C.sub, fontVariantNumeric: 'tabular-nums' }}>
          {Math.min(LETTERS.length, said + (current >= 0 ? 1 : 0))} / {LETTERS.length}
        </div>

        <Heading x={LEFT_X} y={TOP} kannada={GROUPS.svara.kannada} english={GROUPS.svara.english} lit={sectionLit('svara')} colour={GROUPS.svara.colour} />
        <Heading x={RIGHT_X} y={TOP} kannada="ವರ್ಗೀಯ ವ್ಯಂಜನಗಳು" english="Consonants" lit={vyanjanaLit} colour={GROUPS.ka.colour} />
        {LAYOUT.subheads.map((s) => (
          <Heading key={s.group} x={s.x} y={s.y + 4} kannada={GROUPS[s.group].kannada} english={s.group === 'yogavaha' ? 'Yogavahas' : 'Ungrouped'}
            lit={sectionLit(s.group)} colour={GROUPS[s.group].colour} />
        ))}

        {LETTERS.map((letter, i) => (
          <LetterCell key={letter.id} index={i} done={i < said} current={i === current} since={since} outroWave={outroWave(i)} />
        ))}

        <Spotlight key={seg.from} seg={seg} since={since} />

        {/* Progress along the bottom */}
        <div style={{ position: 'absolute', left: LEFT_X, right: 84, bottom: 40, height: 10, borderRadius: 5, background: C.line }}>
          <div style={{ width: (100 * frame) / Math.max(1, durationInFrames - 1) + '%', height: '100%', borderRadius: 5, background: '#E8833A' }} />
        </div>
      </AbsoluteFill>

      {timeline.map((s) =>
        s.clip ? (
          <Sequence key={s.from} from={s.from} durationInFrames={s.frames}>
            <Audio src={staticFile(s.clip.src)} />
          </Sequence>
        ) : null,
      )}
      {music ? <Audio src={staticFile('audio/bed-calm.wav')} loop volume={0.06} /> : null}
    </AbsoluteFill>
  );
};
