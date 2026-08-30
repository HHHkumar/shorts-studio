// ---------------------------------------------------------------------------
// Sub-topics, so a run of videos can concentrate on one section instead of
// wandering across a whole subject.
//
// These fill the "Specific topic" box in step 2. They are suggestions, not a
// closed list: the box stays free text, so anything not here can still be typed.
// Keyed by the subject name exactly as it appears in SUBJECTS and
// ELECTRICAL_SUBJECTS in api.ts.
// ---------------------------------------------------------------------------

export const SUBTOPICS: Record<string, string[]> = {
  // --- power generation ----------------------------------------------------
  // The deepest list here on purpose: it is a working sector, not a syllabus
  // chapter, so it covers the plant floor as well as the theory.
  'Power Generation': [
    'Rankine cycle and thermal plant basics',
    'Boilers and steam generation',
    'Superheaters, reheaters and economisers',
    'Steam turbines — impulse and reaction',
    'Condensers and vacuum',
    'Cooling towers and circulating water',
    'Feedwater heaters and deaerators',
    'Coal handling and pulverisers',
    'Draught systems — FD, ID and PA fans',
    'Ash handling and disposal',
    'Gas turbines and the Brayton cycle',
    'Combined cycle power plants',
    'Cogeneration and captive power',
    'Hydroelectric plants and turbine selection',
    'Pumped storage',
    'Nuclear reactors and the fuel cycle',
    'Solar PV plant design',
    'Concentrated solar thermal',
    'Wind turbines and wind farms',
    'Biomass and waste-to-energy',
    'Diesel and gas engine plants',
    'Alternator construction and cooling',
    'Excitation systems and AVR',
    'Synchronisation and parallel operation',
    'Governors and speed control',
    'Plant load factor and capacity factor',
    'Heat rate and plant efficiency',
    'Auxiliary power consumption',
    'Grid frequency and load dispatch',
    'Reactive power and power factor control',
    'Generator protection schemes',
    'Generator transformers and unit auxiliaries',
    'Switchyard and busbar arrangements',
    'Emission control — ESP, FGD and SCR',
    'DM plant and boiler water chemistry',
    'Outage planning and maintenance',
    'Permit to work and plant safety',
    'Battery energy storage and grid support',
  ],

  // --- electrical syllabus areas -------------------------------------------
  'Basic Electrical Engineering': [
    'Ohm’s law and resistance', 'Kirchhoff’s laws', 'Series and parallel circuits',
    'Work, power and energy', 'Electrostatics and capacitors', 'Magnetic circuits',
    'Electromagnetic induction', 'AC fundamentals and RMS', 'Phasors and impedance',
    'Resonance in RLC circuits', 'Three-phase systems', 'Power factor and its correction',
  ],
  'Network Theory / Circuits': [
    'Mesh and nodal analysis', 'Thevenin and Norton theorems', 'Superposition theorem',
    'Maximum power transfer', 'Transient response — RL, RC and RLC', 'Laplace transform methods',
    'Two-port networks', 'Network topology and graph theory', 'Filters and attenuators',
    'Coupled circuits and mutual inductance',
  ],
  'Electrical Machines': [
    'DC generators', 'DC motors and speed control', 'Transformer construction and losses',
    'Transformer testing — OC and SC', 'Auto-transformers', 'Three-phase transformer connections',
    'Induction motor principles', 'Induction motor starting methods', 'Synchronous generators',
    'Synchronous motors and V-curves', 'Single-phase motors', 'Special machines — stepper and servo',
  ],
  'Power Systems': [
    'Generation, transmission and distribution overview', 'Per-unit system', 'Load flow studies',
    'Symmetrical components', 'Fault analysis', 'Economic load dispatch',
    'Power system stability', 'Corona and its effects', 'Insulators and string efficiency',
    'HVDC transmission', 'FACTS devices', 'Power quality and harmonics',
  ],
  'Transmission & Distribution': [
    'Overhead line parameters', 'Sag and tension calculations', 'ACSR and modern conductors',
    'Underground cables', 'Distribution system layouts', 'Voltage regulation and drop',
    'Substation layouts and equipment', 'Earthing and grounding practice',
    'Transmission line modelling — short, medium and long', 'Ferranti effect',
  ],
  'Switchgear & Protection': [
    'Circuit breaker types', 'Arc quenching and interruption', 'Fuses and MCBs',
    'Overcurrent and earth-fault relays', 'Differential protection', 'Distance protection',
    'Transformer protection', 'Generator protection', 'Busbar protection',
    'Lightning arresters and surge protection', 'CT and PT fundamentals',
  ],
  'Power Electronics & Drives': [
    'Diodes, SCRs, IGBTs and MOSFETs', 'Controlled rectifiers', 'Choppers and DC-DC converters',
    'Inverters and PWM', 'AC voltage controllers', 'Cycloconverters',
    'DC motor drives', 'Induction motor drives and V/f control', 'SMPS and UPS',
    'Solar inverters and MPPT',
  ],
  'Control Systems': [
    'Open and closed loop systems', 'Transfer functions and block diagrams',
    'Time response and damping', 'Steady-state error', 'Routh-Hurwitz stability',
    'Root locus', 'Bode plots and gain margin', 'Nyquist criterion',
    'PID controllers and tuning', 'State-space representation',
  ],
  'Measurements & Instrumentation': [
    'Errors and accuracy', 'Moving coil and moving iron instruments', 'Wattmeters and energy meters',
    'Measurement of resistance — bridges', 'CTs and PTs in measurement', 'Oscilloscopes',
    'Transducers and sensors', 'Digital voltmeters', 'Megger and insulation testing',
    'Calibration and standards',
  ],
  'Analog Electronics': [
    'Diode circuits and rectifiers', 'BJT biasing and amplifiers', 'FET and MOSFET amplifiers',
    'Operational amplifiers', 'Feedback and stability', 'Oscillators',
    'Active filters', 'Voltage regulators', 'Power amplifiers',
  ],
  'Digital Electronics': [
    'Number systems and codes', 'Boolean algebra and K-maps', 'Logic gates and families',
    'Combinational circuits', 'Flip-flops and latches', 'Counters and registers',
    'Memories', 'ADC and DAC', 'Microprocessors and microcontrollers',
  ],
  'Electromagnetic Fields': [
    'Coulomb’s law and electric field', 'Gauss’s law', 'Electric potential and capacitance',
    'Biot-Savart and Ampere’s law', 'Magnetic materials', 'Faraday’s law',
    'Maxwell’s equations', 'Electromagnetic waves', 'Transmission lines and Smith chart',
  ],
  'Signals & Systems': [
    'Continuous and discrete signals', 'LTI systems and convolution', 'Fourier series',
    'Fourier transform', 'Laplace transform', 'Z-transform', 'Sampling theorem',
    'Frequency response',
  ],
  'Electrical Materials': [
    'Conducting materials', 'Insulating materials and dielectric strength',
    'Magnetic materials and hysteresis', 'Semiconductor materials',
    'Superconductors', 'Thermal properties and ageing', 'Testing of insulation',
  ],
  'Utilization of Electrical Energy': [
    'Illumination and lighting design', 'Electric heating', 'Electric welding',
    'Electric traction', 'Electrolysis and electroplating', 'Refrigeration and air conditioning',
    'Energy conservation and audit', 'Motor selection for drives',
  ],
  'Estimation & Costing': [
    'Estimating materials for wiring', 'Load estimation for buildings',
    'Cost of energy and tariffs', 'Overhead line estimation', 'Substation cost estimation',
    'Depreciation and economics of generation', 'Contract and tender basics',
  ],
  'Electrical Wiring & Safety': [
    'Wiring systems and accessories', 'Cable sizing and selection', 'Earthing systems',
    'IE rules and statutory requirements', 'Protective devices in installations',
    'Electric shock and first aid', 'Fire safety in electrical installations',
    'Lockout tagout and safe isolation', 'Testing of installations',
  ],
  'Renewable & Non-conventional Energy': [
    'Solar photovoltaic systems', 'Solar thermal systems', 'Wind energy conversion',
    'Small and micro hydro', 'Biomass and biogas', 'Geothermal energy', 'Tidal and wave energy',
    'Fuel cells', 'Grid integration of renewables', 'Net metering and rooftop solar',
  ],
  'Engineering Mathematics': [
    'Matrices and determinants', 'Eigenvalues and eigenvectors', 'Differential equations',
    'Complex variables', 'Probability and statistics', 'Numerical methods',
    'Vector calculus', 'Laplace and Fourier methods',
  ],

  // --- general STEM subjects ------------------------------------------------
  Physics: [
    'Motion and kinematics', 'Newton’s laws', 'Work, energy and power', 'Momentum and collisions',
    'Circular motion and gravitation', 'Rotational dynamics', 'Fluids and pressure',
    'Thermodynamics', 'Waves and sound', 'Optics and light', 'Electricity and magnetism',
    'Modern physics and relativity', 'Quantum basics', 'Nuclear physics',
  ],
  Chemistry: [
    'Atomic structure', 'Periodic table trends', 'Chemical bonding', 'Stoichiometry and moles',
    'States of matter and gas laws', 'Thermochemistry', 'Chemical equilibrium', 'Acids and bases',
    'Redox and electrochemistry', 'Reaction rates', 'Organic chemistry basics', 'Polymers',
  ],
  Biology: [
    'Cell structure and function', 'DNA, genes and heredity', 'Evolution and natural selection',
    'Photosynthesis', 'Respiration and metabolism', 'Human body systems', 'The immune system',
    'Ecology and ecosystems', 'Microbiology', 'Plant biology', 'Biotechnology',
  ],
  Mathematics: [
    'Number theory and primes', 'Algebra and equations', 'Geometry', 'Trigonometry',
    'Calculus — differentiation', 'Calculus — integration', 'Probability', 'Statistics',
    'Sequences and series', 'Logic and proof', 'Infinity and paradoxes', 'Graph theory',
  ],
  'Astronomy & Space': [
    'The solar system', 'Stars and stellar evolution', 'Black holes', 'Galaxies',
    'The Big Bang and cosmology', 'Exoplanets', 'Space missions and probes', 'Telescopes',
    'Gravity and orbits', 'Dark matter and dark energy', 'The Moon', 'Comets and asteroids',
  ],
  'Computer Science': [
    'Algorithms and complexity', 'Data structures', 'Sorting and searching', 'Recursion',
    'Databases', 'Computer networks', 'Operating systems', 'Cryptography',
    'Machine learning basics', 'Compilers and languages', 'Binary and number representation',
  ],
  Engineering: [
    'Statics and structures', 'Materials and stress', 'Thermodynamics', 'Fluid mechanics',
    'Machine design', 'Manufacturing processes', 'Control and automation', 'Bridges and towers',
    'Engines and turbines', 'Failure analysis',
  ],
  'Earth Science & Geology': [
    'Plate tectonics', 'Earthquakes', 'Volcanoes', 'Rocks and the rock cycle', 'Minerals',
    'Weather and the atmosphere', 'Oceans and currents', 'Glaciers and ice ages',
    'Fossils and geological time', 'Soil and erosion',
  ],
  'Environmental Science': [
    'Climate change', 'The carbon cycle', 'Renewable energy', 'Pollution and air quality',
    'Water resources', 'Biodiversity and extinction', 'Waste and recycling',
    'Sustainable agriculture', 'Ozone and the atmosphere',
  ],
  'Medicine & Human Body': [
    'The heart and circulation', 'Lungs and breathing', 'The digestive system', 'Kidneys',
    'Bones and muscles', 'Hormones and the endocrine system', 'Vaccines and immunity',
    'Antibiotics and resistance', 'Nutrition', 'Sleep', 'Genetics and disease',
  ],
  Neuroscience: [
    'Neurons and signalling', 'Brain anatomy', 'Memory', 'Vision and perception',
    'Sleep and dreams', 'Emotion and the amygdala', 'Learning and plasticity',
    'Neurotransmitters', 'Optical illusions',
  ],
  'Statistics & Probability': [
    'Probability basics', 'Conditional probability and Bayes', 'Distributions',
    'The normal distribution', 'Sampling and bias', 'Hypothesis testing', 'Correlation vs causation',
    'The birthday problem and coincidences', 'Expected value', 'Common statistical fallacies',
  ],
  Economics: [
    'Supply and demand', 'Inflation', 'Interest and compounding', 'Game theory',
    'Market structures', 'Behavioural economics', 'Trade and tariffs', 'Money and banking',
    'Economic indicators',
  ],
  Psychology: [
    'Cognitive biases', 'Memory and forgetting', 'Conditioning and learning', 'Motivation',
    'Personality', 'Social influence and conformity', 'Stress and coping', 'Perception',
    'Decision making',
  ],
  'History of Science': [
    'Ancient astronomy', 'The scientific revolution', 'Newton and the Principia',
    'Darwin and evolution', 'The discovery of the atom', 'Marie Curie and radioactivity',
    'Einstein and relativity', 'The structure of DNA', 'The space race', 'Famous experiments',
  ],
  'General Knowledge': [
    'Inventions that changed the world', 'Everyday science', 'Records and extremes',
    'Common misconceptions', 'How things work', 'Numbers and scale', 'Nature’s oddities',
  ],
};

/** Suggestions for a subject, or an empty list if it has none. */
export function subtopicsFor(subject: string): string[] {
  return SUBTOPICS[subject] || [];
}
