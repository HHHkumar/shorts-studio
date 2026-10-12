// ---------------------------------------------------------------------------
// The equipment a doodle may show - and only as a drawing a person approved.
//
// An image model asked for "a transformer" draws something transformer-like:
// a box with fins, and then bushings where it feels like putting them, wires
// that go nowhere, a conservator on the wrong side or none at all. To a viewer
// revising for an engineering paper that is not decoration, it is a wrong
// picture of the thing the question is about.
//
// So equipment is never drawn afresh for a video. Each kind is drawn once, on
// the Drawings page, from the description here; a person looks at it against
// the checklist beside it and approves it, or draws another, or uploads their
// own. From then on every scene that names that equipment shows that drawing,
// exactly - the same in every video, and free.
//
// Pure data and matching, with no DOM and .ts imports only, so the server loads
// it through type stripping exactly as it loads doodle.ts.
// ---------------------------------------------------------------------------

export interface EquipmentKind {
  id: string;
  name: string;
  /** What a direction calls it. Lower case; matched as whole words, plurals included. */
  words: string[];
  /** What the drawing shows: the brief the image model is given. */
  draw: string;
  /** What to look for before approving it. */
  check: string;
  /** Added by the creator on the Drawings page, not part of the catalogue below. */
  custom?: boolean;
}

export const EQUIPMENT: EquipmentKind[] = [
  {
    id: 'transformer',
    name: 'Power transformer',
    words: ['transformer', 'power transformer', 'step-up transformer', 'step-down transformer', 'distribution transformer'],
    draw: 'an oil-filled power transformer seen from the front at a slight angle: a tall rectangular steel tank, '
      + 'a bank of flat cooling radiator fins on each side, a horizontal cylindrical conservator tank held above '
      + 'the lid on a short pipe, three tall ribbed porcelain bushings standing in a row on the lid, and three '
      + 'much shorter bushings in a row beside them',
    check: 'A tank with radiator fins, a conservator drum above the lid, three tall bushings and three short ones. '
      + 'No wires that go nowhere and no second tank.',
  },
  {
    id: 'pole-transformer',
    name: 'Transformer on a pole',
    words: [
      'transformer on a pole', 'pole-mounted transformer', 'pole transformer', 'transformer on a utility pole',
      'step-down transformer on a pole', 'distribution transformer on a pole',
    ],
    draw: 'a small distribution transformer mounted high on a single wooden utility pole: a can-shaped cylindrical '
      + 'tank with cooling ribs, two ribbed bushings on its lid, a horizontal cross-arm above it carrying three '
      + 'overhead wires on small insulators, a short lead from each bushing up to a wire, and one thinner service '
      + 'wire leaving from the side of the tank',
    check: 'A can-shaped tank below the cross-arm, bushings on top joined up to the lines, one thinner wire leaving.',
  },
  {
    id: 'motor',
    name: 'Electric motor',
    words: [
      'motor', 'electric motor', 'induction motor', 'dc motor', 'ac motor', 'synchronous motor', 'squirrel cage motor',
      'three-phase motor', 'series motor', 'shunt motor',
    ],
    draw: 'an industrial electric motor seen from the side at a slight angle: a horizontal cylindrical body covered '
      + 'in lengthwise cooling fins, a plain round shaft sticking out of one end, a perforated fan cover on the '
      + 'other end, a small rectangular terminal box on top, and two mounting feet bolted to a flat base',
    check: 'A finned cylinder, the shaft at one end, the fan cover at the other, a terminal box on top, feet below.',
  },
  {
    id: 'generator',
    name: 'Generator',
    words: ['generator', 'alternator', 'dc generator', 'ac generator', 'synchronous generator', 'turbo-alternator', 'turbo generator'],
    draw: 'a large power-station generator: a long smooth horizontal cylindrical casing on a solid base, a round end '
      + 'shield with a bearing housing at each end, a thick shaft ending in a bolted coupling flange at one end, '
      + 'and a terminal box low on its side',
    check: 'A large smooth cylinder on a base with a thick shaft and coupling at one end. Not a small finned motor.',
  },
  {
    id: 'cage-rotor',
    name: 'Squirrel-cage rotor',
    words: ['squirrel cage rotor', 'squirrel-cage rotor', 'cage rotor'],
    draw: 'a squirrel-cage rotor on its shaft: a cylinder built of stacked thin steel discs, straight bars running '
      + 'lengthwise in slots all round its surface and set at a slight slant, the bars joined at each end by one '
      + 'solid ring, and a plain shaft through the centre sticking out both ends',
    check: 'Bars all round the surface, joined by a ring at EACH end. No windings, no slip rings, no commutator.',
  },
  {
    id: 'transmission-tower',
    name: 'Transmission tower',
    words: [
      'transmission tower', 'lattice tower', 'steel tower', 'pylon', 'transmission line', 'overhead line',
      'overhead transmission line', 'power line', 'overhead power line',
    ],
    draw: 'one steel lattice transmission tower: a tall tapering four-legged frame of criss-crossed steel angle, '
      + 'three horizontal cross-arms on each side, a string of disc insulators hanging straight down from the tip '
      + 'of every cross-arm, a conductor passing through the bottom of each string and away to both sides, and one '
      + 'thin earth wire running over the very top of the tower',
    check: 'Insulator strings HANG from the arms and the conductors run through the bottom of the strings, never '
      + 'resting on the arms. One earth wire over the peak.',
  },
  {
    id: 'suspension-insulator',
    name: 'Suspension insulator string',
    words: ['suspension insulator', 'insulator string', 'string insulator', 'disc insulator', 'string of insulators', 'insulator disc'],
    draw: 'a suspension insulator string: seven identical bell-shaped porcelain discs linked one below another in a '
      + 'vertical chain, hanging from a steel cross-arm at the top, with a clamp under the lowest disc holding a '
      + 'horizontal stranded conductor',
    check: 'Discs in one vertical chain hanging from the arm, the conductor clamped at the bottom.',
  },
  {
    id: 'pin-insulator',
    name: 'Pin insulator',
    words: ['pin insulator', 'pin-type insulator'],
    draw: 'a pin insulator on a wooden cross-arm: a single bell-shaped porcelain body with two rain sheds, screwed '
      + 'onto a steel pin that stands upright through the cross-arm, with a stranded conductor lying in the groove '
      + 'on top of the insulator and tied to it with binding wire',
    check: 'One porcelain body on an upright pin, the conductor in the groove on TOP.',
  },
  {
    id: 'circuit-breaker',
    name: 'Circuit breaker (outdoor)',
    words: [
      'circuit breaker', 'breaker', 'sf6 circuit breaker', 'sf6 breaker', 'vacuum circuit breaker', 'oil circuit breaker',
      'air blast circuit breaker',
    ],
    draw: 'an outdoor high-voltage circuit breaker: three identical tall vertical porcelain columns with ribbed '
      + 'sheds standing in a row on a steel support frame, each column with a flat metal terminal pad at its top '
      + 'and another halfway up, and one rectangular mechanism cabinet mounted low on the frame',
    check: 'Three ribbed columns in a row, two terminals on each, one mechanism cabinet.',
  },
  {
    id: 'mcb',
    name: 'Miniature circuit breaker',
    words: ['mcb', 'miniature circuit breaker'],
    draw: 'a single-pole miniature circuit breaker from a house distribution board: a narrow upright rectangular '
      + 'moulded block, a small toggle lever on its front face, a screw terminal at the top and another at the '
      + 'bottom, and a notch at the back where it clips onto a mounting rail',
    check: 'A narrow block, one lever, one terminal at the top and one at the bottom.',
  },
  {
    id: 'fuse',
    name: 'Cartridge fuse',
    words: ['fuse', 'cartridge fuse', 'hrc fuse', 'fuse link'],
    draw: 'a cartridge fuse: a short ceramic cylinder with a metal cap on each end and a flat metal blade tag '
      + 'sticking out from each cap',
    check: 'A ceramic barrel, a metal cap and a tag at each end.',
  },
  {
    id: 'relay',
    name: 'Electromagnetic relay',
    words: ['relay', 'electromagnetic relay', 'overcurrent relay', 'protective relay'],
    draw: 'an attracted-armature electromagnetic relay: a coil wound on an upright iron core, a flat iron armature '
      + 'hinged above the core and held up by a small spring, a moving contact on the free end of the armature '
      + 'facing a fixed contact with a small gap between them, all mounted on a flat base',
    check: 'A coil on a core, a hinged armature with its spring, one pair of contacts standing apart.',
  },
  {
    id: 'isolator',
    name: 'Isolator',
    words: ['isolator', 'disconnector', 'isolating switch', 'disconnecting switch'],
    draw: 'an outdoor isolator switch: two post insulators standing upright on a steel base, each with a metal arm '
      + 'on top, the two arms swung open so that there is a wide, clearly visible air gap between their ends',
    check: 'Two post insulators, the arms open with a visible gap. Nothing that looks like an arc chamber.',
  },
  {
    id: 'lightning-arrester',
    name: 'Lightning arrester',
    words: ['lightning arrester', 'lightning arrestor', 'surge arrester', 'surge arrestor', 'surge diverter'],
    draw: 'a station lightning arrester: one tall slim porcelain column with many close ribbed sheds, a metal cap on '
      + 'top joined to an overhead line, a metal base bolted to a steel stand, and an earth lead running from the '
      + 'base straight down into the ground',
    check: 'One ribbed column, the line at the top, an earth lead from the base to the ground.',
  },
  {
    id: 'analog-meter',
    name: 'Analog meter',
    words: [
      'analog meter', 'analogue meter', 'ammeter', 'voltmeter', 'galvanometer', 'wattmeter', 'panel meter', 'meter',
      'analog ammeter', 'analog voltmeter', 'analog wattmeter', 'benchtop meter', 'moving coil meter',
    ],
    draw: 'a rectangular analog panel meter seen from the front: a curved scale arc of evenly spaced plain tick '
      + 'marks, one thin straight pointer needle resting at the far left end of the scale, a small pivot circle at '
      + 'the bottom centre where the needle is hinged, and two screw terminals below the case',
    check: 'A scale of plain ticks with no numbers or letters, ONE needle resting at the left (zero) end, two terminals.',
  },
  {
    id: 'multimeter',
    name: 'Digital multimeter',
    words: ['multimeter', 'digital multimeter', 'dmm'],
    draw: 'a handheld digital multimeter: an upright rectangular body with a blank rectangular display window at the '
      + 'top, a large round rotary selector dial in the middle, three round sockets along the bottom, and two test '
      + 'leads plugged in, one red and one black, each ending in a pointed probe',
    check: 'A blank display with no digits, a rotary dial, sockets, two leads with probes (one of them red).',
  },
  {
    id: 'clamp-meter',
    name: 'Clamp meter',
    words: ['clamp meter', 'clamp-on ammeter', 'tong tester'],
    draw: 'a clamp meter: a handheld body with a blank display and a rotary dial, and at its top a pair of curved '
      + 'jaws closed into a ring around one single cable',
    check: 'The jaws closed around ONE conductor only.',
  },
  {
    id: 'megger',
    name: 'Insulation tester (megger)',
    words: ['megger', 'insulation tester', 'insulation resistance tester'],
    draw: 'a hand-cranked insulation tester: a box-shaped instrument with a curved scale window and a needle on its '
      + 'top face, a folding crank handle on its right side, and two terminals on its left with two test leads '
      + 'ending in crocodile clips',
    check: 'A box, a scale window, the crank handle on the side, two leads with clips.',
  },
  {
    id: 'energy-meter',
    name: 'Energy meter',
    words: ['energy meter', 'electricity meter', 'kwh meter', 'watt-hour meter', 'watthour meter', 'electrical energy meter'],
    draw: 'a household electromechanical energy meter: an upright rounded case with a glass front, a thin '
      + 'horizontal aluminium disc seen edge-on through a slot in the middle, a row of small blank counter windows '
      + 'above the disc, and a terminal cover at the bottom with cables entering from below',
    check: 'A glass-fronted case, the disc seen edge-on, blank counter windows, the terminal block at the bottom.',
  },
  {
    id: 'oscilloscope',
    name: 'Oscilloscope',
    words: ['oscilloscope', 'oscilloscope screen', 'cro'],
    draw: 'a bench oscilloscope seen from the front: a wide box with a square screen on the left showing only an '
      + 'empty grid of squares, rows of round knobs and small buttons on the right, and one probe cable plugged '
      + 'into a round socket at the bottom',
    check: 'An EMPTY grid on the screen - no trace, because a trace states a waveform. Knobs, one probe.',
  },
  {
    id: 'thyristor',
    name: 'Thyristor (SCR)',
    words: ['thyristor', 'scr', 'silicon controlled rectifier'],
    draw: 'a stud-mounted thyristor: a hexagonal metal base with a threaded stud pointing down, a short cylindrical '
      + 'body above it, one thick braided lead coming out of the top and ending in a ring lug, and one thin wire '
      + 'lead beside the thick one',
    check: 'A threaded stud, one thick lead and one thin lead: three connections and no more.',
  },
  {
    id: 'diode',
    name: 'Diode',
    words: ['diode', 'rectifier diode', 'power diode', 'zener diode'],
    draw: 'a small axial rectifier diode: a black cylindrical body with one painted band round one end only, and a '
      + 'straight wire lead coming out of each end',
    check: 'A single band, at ONE end only. Two leads.',
  },
  {
    id: 'transistor',
    name: 'Transistor',
    words: ['transistor', 'bjt', 'mosfet', 'igbt'],
    draw: 'a small plastic transistor: a half-cylinder black body with one flat face, and three straight parallel '
      + 'wire legs coming out of the bottom',
    check: 'Three legs, and only three.',
  },
  {
    id: 'resistor',
    name: 'Resistor',
    words: ['resistor', 'resistor coil', 'shunt resistor', 'carbon resistor'],
    draw: 'an axial carbon resistor: a small sausage-shaped body slightly thicker at both ends with four plain bands '
      + 'round it, and a straight wire lead from each end',
    check: 'A banded body with a lead at each end.',
  },
  {
    id: 'capacitor',
    name: 'Capacitor',
    words: ['capacitor', 'electrolytic capacitor', 'two-plate capacitor', 'capacitor plate'],
    draw: 'an electrolytic capacitor: an upright cylindrical can with one plain stripe down its side, and two '
      + 'straight wire legs of unequal length coming out of the bottom',
    check: 'A can with one stripe and two legs, one shorter than the other.',
  },
  {
    id: 'inductor',
    name: 'Inductor',
    words: ['inductor', 'inductor coil', 'coil inductor', 'choke', 'choke coil'],
    draw: 'an inductor: thick enamelled copper wire wound in one neat layer of close turns round a straight '
      + 'cylindrical iron core, with the two ends of the wire sticking straight out, one at each end of the core',
    check: 'One layer of turns on a straight core, two free ends.',
  },
  {
    id: 'busbar',
    name: 'Busbars',
    words: ['busbar', 'bus bar', 'busbar conductor', 'copper busbar'],
    draw: 'three flat rectangular copper busbars running horizontally and parallel, one above another with equal '
      + 'gaps, each resting on a row of short post insulators that stand on a steel frame',
    check: 'Three separate flat bars, each on its own insulators, never touching.',
  },
  {
    id: 'power-cable',
    name: 'Armoured power cable',
    words: ['underground cable', 'armoured cable', 'armored cable', 'three-core cable'],
    draw: 'the cut end of a three-core armoured power cable seen at an angle with its layers stepped back one after '
      + 'another: three stranded copper conductors each in its own insulation, a common inner sheath round all '
      + 'three, a ring of round steel armour wires, and a thick outer sheath',
    check: 'From the centre out: three insulated cores, an inner sheath, a ring of armour wires, the outer sheath.',
  },
  {
    id: 'solar-panel',
    name: 'Solar panel',
    words: ['solar panel', 'pv panel', 'solar module', 'photovoltaic panel'],
    draw: 'a solar panel: a flat rectangular panel tilted back on a metal frame stand, its face divided into a '
      + 'regular grid of square cells, with a small junction box and two cables on its back edge',
    check: 'A regular grid of cells on a tilted frame, two cables from one junction box.',
  },
  {
    id: 'wind-turbine',
    name: 'Wind turbine',
    words: ['wind turbine', 'windmill'],
    draw: 'a wind turbine: a tall slender tapering tower, a box-shaped housing on top, and a hub at the front of the '
      + 'housing carrying exactly three long slender blades evenly spaced',
    check: 'Exactly three blades.',
  },
];

const ID = /^[a-z0-9]+(?:-[a-z0-9]+){0,5}$/;

/** Whether an id is one this file, or the Drawings page, could have made. */
export const isEquipmentId = (id: unknown): id is string => typeof id === 'string' && id.length <= 40 && ID.test(id);

/** An id for a name the creator typed: "Buchholz relay" becomes "buchholz-relay". */
export function equipmentId(name: string): string {
  const id = String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').split('-').slice(0, 6).join('-').slice(0, 40).replace(/-+$/, '');
  return ID.test(id) ? id : '';
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * A phrase as a pattern: whole words, a space or a hyphen between them, and a
 * plural on the end. "bus bar" finds "bus-bars"; "meter" does not find "metered".
 */
export function phrasePattern(phrase: string): RegExp {
  const words = String(phrase || '').trim().toLowerCase().split(/[\s-]+/).filter(Boolean).map(escape);
  return new RegExp('(?<![a-z0-9])' + words.join('[\\s-]+') + '(?:s|es)?(?![a-z0-9])', 'g');
}

export interface Found {
  id: string;
  start: number;
  end: number;
}

/** Every place a list of phrases appears, the longest phrase winning where two overlap. */
export function findPhrases(text: string, phrases: { id: string; phrase: string }[], taken: Found[] = []): Found[] {
  const lower = String(text || '').toLowerCase();
  const all: Found[] = [];
  for (const { id, phrase } of phrases) {
    if (!phrase.trim()) continue;
    for (const m of lower.matchAll(phrasePattern(phrase))) all.push({ id, start: m.index || 0, end: (m.index || 0) + m[0].length });
  }
  all.sort((a, b) => (b.end - b.start) - (a.end - a.start) || a.start - b.start);
  const kept: Found[] = [];
  const clear = (f: Found, of: Found[]) => of.every((k) => f.end <= k.start || f.start >= k.end);
  for (const f of all) if (clear(f, kept) && clear(f, taken)) kept.push(f);
  return kept.sort((a, b) => a.start - b.start);
}

/**
 * The equipment a piece of text names, in the order it names it. "A current
 * transformer" is not "a transformer": the longest name wins, so a kind added
 * for the longer one takes the words away from the shorter.
 */
export function findEquipment(text: string, kinds: EquipmentKind[] = EQUIPMENT): Found[] {
  return findPhrases(text, kinds.flatMap((k) => k.words.map((phrase) => ({ id: k.id, phrase }))));
}

/** The catalogue with the creator's own kinds added; one of theirs with a catalogue id replaces it. */
export function allKinds(custom: EquipmentKind[] = []): EquipmentKind[] {
  const mine = custom.filter((k) => k && isEquipmentId(k.id));
  const replaced = new Set(mine.map((k) => k.id));
  return [...EQUIPMENT.filter((k) => !replaced.has(k.id)), ...mine.map((k) => ({ ...k, custom: true }))];
}
