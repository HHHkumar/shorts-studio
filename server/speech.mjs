// ---------------------------------------------------------------------------
// Saying unit symbols out loud.
//
// ElevenLabs reads "10 MW" as "ten mili wag". It is not wrong to do so - "MW"
// is not a word - but for a power engineering channel it is fatal, and it
// happens in almost every numerical question.
//
// The obvious fix, rewriting the script to say "ten megawatts", costs the thing
// that makes these videos readable: the screen would then also say
// "ten megawatts", when "10 MW" is how an engineer writes it and much easier to
// take in at a glance.
//
// So the text is expanded for the VOICE only, and every spoken word remembers
// which written word it came from. ElevenLabs times the spoken words; those
// timings are then collapsed back onto the written ones. The result is that the
// screen shows "10 MW", the voice says "ten megawatts", and the highlight lands
// on "MW" at the moment it is spoken.
//
// Symbols are only ever expanded when a number is attached to them or directly
// in front. That single rule is what makes this safe: "A" stays the article
// unless it is "5 A", "min" stays a word unless it is "30 min", and prose is
// never touched.
// ---------------------------------------------------------------------------

/**
 * Unit symbols, singular and plural. Case matters and is deliberate:
 * `mV` is millivolt, `MV` is megavolt; `mW` is milliwatt, `MW` is megawatt.
 */
const UNITS = {
  // Power
  W: ['watt', 'watts'],
  mW: ['milliwatt', 'milliwatts'],
  kW: ['kilowatt', 'kilowatts'],
  MW: ['megawatt', 'megawatts'],
  GW: ['gigawatt', 'gigawatts'],
  // Energy
  Wh: ['watt hour', 'watt hours'],
  kWh: ['kilowatt hour', 'kilowatt hours'],
  MWh: ['megawatt hour', 'megawatt hours'],
  GWh: ['gigawatt hour', 'gigawatt hours'],
  TWh: ['terawatt hour', 'terawatt hours'],
  J: ['joule', 'joules'],
  kJ: ['kilojoule', 'kilojoules'],
  MJ: ['megajoule', 'megajoules'],
  // Apparent and reactive power
  VA: ['volt ampere', 'volt amperes'],
  kVA: ['kilovolt ampere', 'kilovolt amperes'],
  MVA: ['megavolt ampere', 'megavolt amperes'],
  VAr: ['volt ampere reactive', 'volt amperes reactive'],
  kVAr: ['kilovolt ampere reactive', 'kilovolt amperes reactive'],
  MVAr: ['megavolt ampere reactive', 'megavolt amperes reactive'],
  // Voltage
  V: ['volt', 'volts'],
  mV: ['millivolt', 'millivolts'],
  kV: ['kilovolt', 'kilovolts'],
  MV: ['megavolt', 'megavolts'],
  // Current
  A: ['ampere', 'amperes'],
  mA: ['milliampere', 'milliamperes'],
  kA: ['kiloampere', 'kiloamperes'],
  // Resistance
  'Ω': ['ohm', 'ohms'],
  'kΩ': ['kilohm', 'kilohms'],
  'MΩ': ['megohm', 'megohms'],
  // Capacitance and inductance
  F: ['farad', 'farads'],
  uF: ['microfarad', 'microfarads'],
  'µF': ['microfarad', 'microfarads'],
  nF: ['nanofarad', 'nanofarads'],
  pF: ['picofarad', 'picofarads'],
  H: ['henry', 'henries'],
  mH: ['millihenry', 'millihenries'],
  uH: ['microhenry', 'microhenries'],
  'µH': ['microhenry', 'microhenries'],
  // Frequency
  Hz: ['hertz', 'hertz'],
  kHz: ['kilohertz', 'kilohertz'],
  MHz: ['megahertz', 'megahertz'],
  GHz: ['gigahertz', 'gigahertz'],
  // Mechanical
  N: ['newton', 'newtons'],
  kN: ['kilonewton', 'kilonewtons'],
  Nm: ['newton metre', 'newton metres'],
  Pa: ['pascal', 'pascals'],
  kPa: ['kilopascal', 'kilopascals'],
  MPa: ['megapascal', 'megapascals'],
  bar: ['bar', 'bar'],
  rpm: ['revolution per minute', 'revolutions per minute'],
  // Time
  ms: ['millisecond', 'milliseconds'],
  us: ['microsecond', 'microseconds'],
  'µs': ['microsecond', 'microseconds'],
  hr: ['hour', 'hours'],
  // Mass, length, temperature
  kg: ['kilogram', 'kilograms'],
  km: ['kilometre', 'kilometres'],
  cm: ['centimetre', 'centimetres'],
  mm: ['millimetre', 'millimetres'],
  '°C': ['degree Celsius', 'degrees Celsius'],
  '°F': ['degree Fahrenheit', 'degrees Fahrenheit'],
  // Ratios
  '%': ['percent', 'percent'],
  pu: ['per unit', 'per unit'],
  pf: ['power factor', 'power factor'],
};

/**
 * Deliberately absent, because the risk of a wrong expansion outweighs the
 * gain: `m` (metre / milli / the letter), `s` (second / plural), `t` (tonne),
 * `g` (gram), `K` (kelvin / thousand), `min` (minute / minimum), `T` (tesla /
 * time). Every one of them appears far more often as something else.
 */

/** Longest first, so "kWh" is matched before "kW", and "kΩ" before "Ω". */
const UNIT_KEYS = Object.keys(UNITS).sort((a, b) => b.length - a.length);

/** A number, including decimals, thousands separators and a leading sign. */
const NUMBER = /^[+-]?\d[\d,]*(?:\.\d+)?$/;

const isNumber = (token) => NUMBER.test(token);

/** "1" and "one" take the singular; everything else, including 0, takes plural. */
const wantsPlural = (numberToken) => {
  const n = String(numberToken).replace(/,/g, '');
  return !(n === '1' || n === '1.0' || n === '+1' || n.toLowerCase() === 'one');
};

/**
 * Split a token into leading number, unit symbol and trailing punctuation:
 * "100MW," -> { number: '100', unit: 'MW', tail: ',' }
 * Returns null when the token is not a number-and-unit at all.
 */
function splitUnit(token) {
  const m = token.match(/^([+-]?\d[\d,]*(?:\.\d+)?)\s*(.+?)([.,;:!?)\]]*)$/);
  if (!m) return null;
  const unit = UNIT_KEYS.find((k) => k === m[2]);
  return unit ? { number: m[1], unit, tail: m[3] } : null;
}

/** A bare unit symbol with optional trailing punctuation: "MW," -> MW. */
function bareUnit(token) {
  const m = token.match(/^(.+?)([.,;:!?)\]]*)$/);
  if (!m) return null;
  const unit = UNIT_KEYS.find((k) => k === m[1]);
  return unit ? { unit, tail: m[2] } : null;
}

/**
 * Rewrite a line so a voice model pronounces its units, keeping a record of
 * where every spoken word came from.
 *
 * Returns:
 *   spoken  - the text to send to the voice model
 *   written - the original words, which are what stays on screen
 *   map     - one entry per spoken word, holding the index in `written` that
 *             it belongs to
 */
export function expandForSpeech(text) {
  const written = String(text || '').trim().split(/\s+/).filter(Boolean);
  const spoken = [];
  const map = [];

  const push = (word, writtenIndex) => {
    spoken.push(word);
    map.push(writtenIndex);
  };

  written.forEach((token, i) => {
    // "100MW" or "60%" - the number is stuck to the symbol.
    const joined = splitUnit(token);
    if (joined) {
      const [one, many] = UNITS[joined.unit];
      const words = (wantsPlural(joined.number) ? many : one).split(' ');
      push(joined.number, i);
      words.forEach((w, k) => push(k === words.length - 1 ? w + joined.tail : w, i));
      return;
    }

    // "10 MW" - a lone symbol, but only when a number came right before it.
    // Without that test "A" would become "ampere" in the middle of a sentence.
    const bare = bareUnit(token);
    if (bare && i > 0 && isNumber(written[i - 1].replace(/[.,;:!?)\]]*$/, ''))) {
      const [one, many] = UNITS[bare.unit];
      const words = (wantsPlural(written[i - 1]) ? many : one).split(' ');
      words.forEach((w, k) => push(k === words.length - 1 ? w + bare.tail : w, i));
      return;
    }

    push(token, i);
  });

  return { spoken: spoken.join(' '), written, map };
}

/**
 * Fold spoken-word timings back onto the written words.
 *
 * A written word covers all of the spoken words it produced, so "MW" starts
 * when "megawatts" starts and ends when it ends, and "kWh" spans both
 * "kilowatt" and "hours".
 *
 * The voice model is not obliged to give back exactly the words we sent - it
 * merges, splits and drops punctuation - so when the counts disagree this
 * returns the spoken timings untouched. Highlighting slightly the wrong word is
 * a far smaller failure than throwing away the timings altogether.
 */
export function collapseTimings(words, written, map) {
  if (!words.length || !written.length) return words;
  if (words.length !== map.length) return words;

  const out = [];
  let i = 0;
  while (i < words.length) {
    const index = map[i];
    let j = i;
    while (j + 1 < words.length && map[j + 1] === index) j++;
    out.push({ word: written[index], start: words[i].start, end: words[j].end });
    i = j + 1;
  }
  return out;
}
