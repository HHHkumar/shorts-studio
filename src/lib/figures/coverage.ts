// ---------------------------------------------------------------------------
// Which figure draws which syllabus subtopic, and how much of that is built.
//
// Every subtopic in src/lib/subtopics.ts lands in exactly one of:
//   a family      - a computed figure draws its questions (built or planned)
//   illustration  - descriptive; no number to compute. Served by the icon,
//                   panel and image tools, not by a figure family.
//   text          - no picture helps: grammar, current affairs, procedure.
//
// The test fails on any subtopic that matches nothing, so a new subtopic cannot
// quietly go uncovered. `node tools/figure-coverage.mjs` prints the progress.
// ---------------------------------------------------------------------------

export interface PlannedFamily {
  id: string;
  label: string;
  /** Matched against "Subject: subtopic". */
  topics: RegExp;
}

/**
 * In build order. The first match wins, so the more specific families come first.
 * Whether one is built is not written here - it is whether src/lib/figures/index.ts
 * lists a family with that id - so this file cannot claim something is done.
 */
export const PLAN: PlannedFamily[] = [
  { id: 'junction', label: 'Currents at a node (KCL)',
    topics: /Kirchhoff/i },
  { id: 'circuit', label: 'Solved circuits, DC and AC',
    topics: /Ohm|Series and parallel|Work, power and energy|Physics: Electricity and magnetism|Mesh and nodal|Thevenin|Superposition|Maximum power transfer|Measurement of resistance|Filters and attenuators|Two-port|Network topology/i },
  { id: 'ac', label: 'Phasors and waveforms, with power',
    topics: /AC fundamentals|Phasors and impedance|Resonance in RLC|Coupled circuits|Power quality and harmonics|Symmetrical components|Fourier series|Oscilloscopes|Continuous and discrete signals|Sampling theorem|Complex variables/i },
  { id: 'power-triangle', label: 'Power triangle and power-factor correction',
    topics: /Power factor|Reactive power|Wattmeters and energy meters|Cost of energy and tariffs/i },
  { id: 'three-phase', label: 'Star and delta, line and phase values',
    topics: /Three-phase systems|Three-phase transformer connections|Per-unit system|Fault analysis/i },
  { id: 'transformer', label: 'Transformers and magnetic circuits',
    topics: /Transformer|Magnetic circuits|Electromagnetic induction|CTs and PTs|CT and PT|Faraday|Auto-transformers|Generator transformers/i },
  { id: 'machine', label: 'Rotating machines: fields, speed and slip',
    topics: /Induction motor|Synchronous|DC generators|DC motors|Single-phase motors|Special machines|Alternator|Excitation|Governors|Motor selection|motor drives|Electric traction/i },
  { id: 'graph', label: 'Plotted curves with computed points',
    topics: /Algebra and equations|Calculus|Functions and their graphs|Quadratic equations|Sum and product of roots|Inequalities|Supply and demand|Market structures|Inflation|Interest and compounding|States of matter and gas laws|Reaction rates|Chemical equilibrium|Thermochemistry|Engineering: Thermodynamics|Physics: Thermodynamics|Materials and stress|Waves and sound|Nuclear physics|Transient response|Time response|Steady-state error|Bode|Root locus|Nyquist|Laplace|Z-transform|Fourier transform|Frequency response|Differential equations|Distributions|normal distribution|Stability|Sag and tension|Magnetic materials and hysteresis|Transmission line modelling|Ferranti|Voltage regulation|Diode circuits|Controlled rectifiers|Choppers|Inverters and PWM|AC voltage controllers|Cycloconverters|SMPS|MPPT|Eigenvalues|Numerical methods|Gravity and orbits|growth|Population|depreciation|When money doubles/i },
  { id: 'chart', label: 'Bar, line and pie charts from data',
    topics: /Data Interpretation|Mathematics: Statistics|Economic indicators|Periodic table trends|Plant load factor|capacity factor|Heat rate|Economic load dispatch|Load estimation|Grid frequency and load dispatch|Correlation vs causation|Sampling and bias|Probability and statistics|Numbers and scale|Records and extremes|Energy conservation and audit|Load flow/i },
  { id: 'geometry', label: 'Triangles, circles, heights and distances',
    topics: /Geometry & Mensuration: (Triangles|Congruence|Pythagoras|Circles|Quadrilaterals|Coordinate|Area and perimeter)|Trigonometry & Heights|Mathematics: (Geometry|Trigonometry)|Linear equations in one and two|Vector calculus|Illumination/i },
  { id: 'solid', label: 'Solids, nets and cubes',
    topics: /Surface area and volume|Cylinders, cones|Prisms, pyramids|Painted cube|Cutting a cube|Dice faces|Cube and dice from a net/i },
  { id: 'bars', label: 'Bar models for ratio, percentage, mixture and work',
    topics: /Percentage, Ratio|Stoichiometry and moles|Word problems into equations|Average, Mixture|Profit, Loss|Simple & Compound Interest|Time & Work|Partnership|Percentage to fraction|Fractions, decimals|Expected value|Estimation & Costing: (Estimating materials|Overhead line estimation|Substation cost)|Depreciation and economics/i },
  { id: 'motion', label: 'Tracks, trains, boats and races',
    topics: /Time, Speed & Distance/i },
  { id: 'clock', label: 'Clock faces and calendars',
    topics: /clock|Odd days|Leap years|Repeating calendar|Scheduling by day/i },
  { id: 'venn', label: 'Venn diagrams for sets and syllogisms',
    topics: /Syllogism & Statement Reasoning: (All, some|Venn|Possibility|Either-or|Reverse syllogism)|Mathematics: Probability|Independent and mutually exclusive|Conditional probability|At least one|Probability basics|Probability of a single event|cards, dice and balls|birthday problem/i },
  { id: 'tree', label: 'Family trees, probability trees and direction paths',
    topics: /Blood Relations|Permutation, Combination|Graph theory|Game theory|DNA, genes and heredity|counting principle|Data structures|Recursion|Algorithms and complexity|Sorting and searching/i },
  { id: 'arrangement', label: 'Seating, ranking and ordering puzzles',
    topics: /Puzzles & Seating|Ranking|Number of people in a row|Order of arrival/i },
  { id: 'logic', label: 'Logic gates, truth tables and timing',
    topics: /Digital Electronics|Boolean|Logic gates|Flip-flops|Counters and registers|Combinational|ADC and DAC|Memories|Microprocessors/i },
  { id: 'field', label: 'Charges, fields and capacitor plates',
    topics: /Electrostatics and capacitors|Coulomb|Gauss|Electric potential|Biot-Savart|Maxwell|Electromagnetic waves|Smith chart|Corona|Insulators and string efficiency|Dielectric strength/i },
  { id: 'block', label: 'Block diagrams, feedback and op-amps',
    topics: /Control and automation|Open and closed loop|Transfer functions|Routh|PID|State-space|LTI systems|Operational amplifiers|Feedback and stability|Oscillators|Active filters|BJT biasing|FET and MOSFET|Voltage regulators|Power amplifiers|Matrices and determinants/i },
  { id: 'number', label: 'Number lines, bases, series and remainders',
    topics: /Number theory and primes|Sequences and series|Arithmetic and geometric progressions|Algebraic identities|Simplifying algebraic fractions|Number System|Simplification & Approximation|Series — Number & Alphabet|Binary and number|Number systems|Base systems|Coding-Decoding: (Letter shifting|Number coded)|Data Sufficiency in number/i },
  { id: 'mechanics', label: 'Forces, motion, collisions and beams',
    topics: /Motion and kinematics|Newton|Physics: Work, energy and power|Momentum and collisions|Circular motion and gravitation|Rotational dynamics|Fluids and pressure|Fluid mechanics|Statics and structures|Bridges and towers|Electric traction/i },
  { id: 'optics', label: 'Rays through lenses, mirrors and prisms',
    topics: /Optics and light|Telescopes|Refraction|Mirror and water images|Vision and perception/i },
  { id: 'layout-plan', label: 'Single-line diagrams and plant layouts',
    topics: /Switchyard|busbar|Busbar|Substation layouts|Distribution system layouts|Generation, transmission and distribution overview|Earthing|earthing|HVDC|FACTS|Overcurrent and earth-fault|Differential protection|Distance protection|Transformer protection|Generator protection|Lightning arresters|Grid integration|Net metering|Solar PV plant design|Solar photovoltaic|Cable sizing|Overhead line parameters|Underground cables|ACSR|Combined cycle|Rankine|Brayton|Pumped storage|Hydroelectric|Battery energy storage|Wind/i },
];

/** Descriptive subtopics: a labelled illustration serves them, not a computed figure. */
export const ILLUSTRATION = /Chemistry|Biology|Neuroscience|Psychology|Physics: (Modern physics|Quantum)|Engineering: (Machine design|Manufacturing|Engines and turbines|Failure analysis)|Economics: (Behavioural|Trade and tariffs|Money and banking)|Astronomy & Space|Earth Science|Environmental Science|Medicine & Human Body|Renewable & Non-conventional Energy|Power Generation|Electrical Materials|Utilization of Electrical Energy|Switchgear & Protection|Electrical Wiring & Safety|Measurements & Instrumentation|Power Electronics & Drives|Computer Science|History of Science|General Knowledge|General Science|Computer Awareness|Non-verbal Reasoning|Electromagnetic Fields|Power Systems|Transmission & Distribution|Signals & Systems|Control Systems|Analog Electronics|Engineering Mathematics|Statistics & Probability|Estimation & Costing|Network Theory|Electrical Machines|Basic Electrical/i;

/** No picture helps these: language, current affairs, rules and procedure. */
export const TEXT_ONLY = /Logic and proof|Infinity and paradoxes|English Language|General Awareness|Static GK|Analogy & Classification|Analytical & Critical Reasoning|Statement and assumption|Statement and conclusion|course of action|Cause and effect|Coding-Decoding|Data Sufficiency|IE rules|Permit to work|Contract and tender|Outage planning|Electric shock and first aid|Lockout tagout/i;

export type Coverage =
  | { kind: 'family'; family: PlannedFamily }
  | { kind: 'illustration' }
  | { kind: 'text' };

/** Where one subtopic lands. Families win over illustration; text-only wins over both. */
export function coverageOf(subject: string, subtopic: string): Coverage | null {
  const key = subject + ': ' + subtopic;
  if (TEXT_ONLY.test(key)) return { kind: 'text' };
  const family = PLAN.find((f) => f.topics.test(key));
  if (family) return { kind: 'family', family };
  if (ILLUSTRATION.test(key)) return { kind: 'illustration' };
  return null;
}
