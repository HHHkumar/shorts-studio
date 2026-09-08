// ---------------------------------------------------------------------------
// Sub-topics, so a run of videos can concentrate on one section instead of
// wandering across a whole subject.
//
// These fill the "Specific topic" box in step 2. They are suggestions, not a
// closed list: the box stays free text, so anything not here can still be typed.
// Keyed by the subject name exactly as it appears in SUBJECTS,
// ELECTRICAL_SUBJECTS and APTITUDE_SUBJECTS in api.ts.
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

  // --- aptitude: the numerical half ----------------------------------------
  // Written as the chapter names candidates actually search for, because the
  // sub-topic is what the video gets titled around.
  'Number System': [
    'Divisibility rules', 'HCF and LCM', 'Remainder theorem and cyclicity',
    'Unit digit of a large power', 'Number of trailing zeroes', 'Factors and their count',
    'Prime numbers and co-primes', 'Base systems and conversions', 'Surds and indices',
    'Fractions, decimals and ordering',
  ],
  'Simplification & Approximation': [
    'BODMAS order of operations', 'Approximation to the nearest option',
    'Squares, cubes and roots up to 30', 'Multiplication shortcuts', 'Percentage to fraction table',
    'Simplifying nested fractions', 'Estimating before calculating', 'Recurring decimals',
    'When to approximate and when not to',
  ],
  'Percentage, Ratio & Proportion': [
    'Percentage change and reverse percentage', 'Successive percentage change',
    'Ratio into parts', 'Compound ratio and proportion', 'Direct and inverse variation',
    'Partnership and profit sharing', 'Population growth problems', 'Percentage in exam marks',
    'The fraction equivalents worth memorising', 'Income and expenditure problems',
  ],
  'Average, Mixture & Alligation': [
    'Average of a series', 'Weighted average', 'Change in average when one item enters or leaves',
    'The alligation rule', 'Mixtures of two liquids', 'Repeated replacement from a vessel',
    'Average speed versus average of speeds', 'Average of consecutive numbers',
    'Mixture and cost price problems',
  ],
  'Profit, Loss & Discount': [
    'Cost price, selling price and marked price', 'Profit and loss percentage',
    'Successive discounts', 'Discount and markup together', 'False weights and dishonest dealers',
    'Break-even and equal profit-loss', 'Partnership profit division', 'Selling at the same price twice',
    'Goods sold in lots',
  ],
  'Simple & Compound Interest': [
    'Simple interest basics', 'Compound interest and the growth idea',
    'Difference between SI and CI', 'Half-yearly and quarterly compounding',
    'Instalments and EMI basics', 'Compound interest as successive percentage',
    'Population and depreciation', 'Rate and time from a given difference',
    'When money doubles or triples',
  ],
  'Time, Speed & Distance': [
    'Basic speed conversions', 'Relative speed — same and opposite direction',
    'Trains crossing poles, platforms and each other', 'Boats and streams',
    'Average speed over two legs', 'Races and head starts', 'Circular tracks and meeting points',
    'Escalator problems', 'Journeys with a change of speed',
  ],
  'Time & Work': [
    'Unitary method and work per day', 'The LCM method for work',
    'Efficiency and the inverse of time', 'Men, days and hours together',
    'Pipes and cisterns', 'Leaks and outlet pipes', 'Alternate day working',
    'Wages divided by work done', 'Work left after somebody leaves',
  ],
  Algebra: [
    'Linear equations in one and two variables', 'Quadratic equations and their roots',
    'Sum and product of roots', 'Algebraic identities worth knowing',
    'Simplifying algebraic fractions', 'Inequalities and their sign changes',
    'Arithmetic and geometric progressions', 'Functions and their graphs',
    'Word problems into equations',
  ],
  'Geometry & Mensuration': [
    'Triangles and their properties', 'Congruence and similarity', 'Pythagoras and triples',
    'Circles, chords and tangents', 'Quadrilaterals and polygons', 'Coordinate geometry basics',
    'Area and perimeter of plane figures', 'Surface area and volume of solids',
    'Cylinders, cones and spheres', 'Prisms, pyramids and frustums',
  ],
  'Trigonometry & Heights': [
    'Trigonometric ratios and the standard table', 'Identities and their proofs',
    'Complementary angles', 'Maximum and minimum values',
    'Heights and distances with one observer', 'Angles of elevation and depression',
    'Two observers on the same line', 'Shadow length problems',
    'Trigonometry inside geometry questions',
  ],
  'Permutation, Combination & Probability': [
    'The fundamental counting principle', 'Permutations with and without repetition',
    'Combinations and when order stops mattering', 'Circular arrangements',
    'Arrangements with identical items', 'Probability of a single event',
    'Independent and mutually exclusive events', 'Probability with cards, dice and balls',
    'At least one and the complement trick',
  ],
  'Data Interpretation': [
    'Reading a table quickly', 'Bar graphs and grouped bars', 'Line graphs and trends',
    'Pie charts and central angles', 'Mixed and caselet DI', 'Percentage change across a graph',
    'Ratio comparisons inside a chart', 'Missing data DI', 'Approximation to save time in DI',
    'Choosing which question to skip',
  ],
  'Data Sufficiency': [
    'The five standard answer options', 'Deciding without actually solving',
    'One statement alone is enough', 'Both statements together',
    'The trap of assuming extra information', 'Data sufficiency in geometry',
    'Data sufficiency in number systems', 'Common careless errors',
    'Two-statement versus three-statement formats',
  ],

  // --- aptitude: reasoning --------------------------------------------------
  'Series — Number & Alphabet': [
    'Difference and second-difference series', 'Multiplication and division series',
    'Square and cube based series', 'Prime number series', 'Alternating and mixed series',
    'Alphabet position series', 'Letter-number combined series', 'Wrong term in a series',
    'Missing term in the middle',
  ],
  'Coding-Decoding': [
    'Letter shifting codes', 'Number coded words', 'Substitution coding',
    'Conditional coding rules', 'Symbol and mixed coding', 'Coding by word position',
    'Decoding a message from examples', 'New pattern coding for banking exams',
    'Finding the rule from two examples',
  ],
  'Blood Relations, Direction & Ranking': [
    'Family tree from a statement', 'Coded blood relations',
    'Generation and gender puzzles', 'Direction sense and turns',
    'Shortest distance after a path', 'Shadow and sun direction problems',
    'Ranking from both ends', 'Number of people in a row', 'Order of arrival puzzles',
  ],
  'Syllogism & Statement Reasoning': [
    'All, some and no statements', 'Venn diagrams for syllogism',
    'Possibility cases and when they hold', 'Either-or conclusions',
    'Reverse syllogism', 'Statement and assumption', 'Statement and conclusion',
    'Statement and course of action', 'Cause and effect questions',
  ],
  'Puzzles & Seating Arrangement': [
    'Linear arrangement in one row', 'Two rows facing each other',
    'Circular arrangement facing in and out', 'Square and rectangular tables',
    'Floor and flat puzzles', 'Scheduling by day, month or year',
    'Box and stack puzzles', 'Categorised puzzles with two variables',
    'Where to start when nothing is fixed',
  ],
  'Analogy & Classification': [
    'Word analogies and their relationship types', 'Number analogies',
    'Letter analogies', 'Odd one out in words', 'Odd one out in numbers',
    'Choosing the analogous pair', 'Meaning-based classification',
    'Mixed analogy formats', 'Spotting the intended relationship first',
  ],
  'Non-verbal Reasoning': [
    'Figure series and rotation', 'Mirror and water images', 'Paper folding and punching',
    'Embedded and hidden figures', 'Figure completion', 'Cube and dice from a net',
    'Counting figures in a diagram', 'Dot situation problems', 'Figure matrix puzzles',
  ],
  'Analytical & Critical Reasoning': [
    'Identifying the conclusion of an argument', 'Strengthening and weakening an argument',
    'Assumptions the argument depends on', 'Inference versus stated fact',
    'Flaws in reasoning', 'Paradox and resolution questions',
    'Evaluating evidence', 'Logical consistency of statements',
    'Decision making and eligibility criteria',
  ],
  'Clocks, Calendars & Cubes': [
    'Angle between the hands of a clock', 'Times when the hands overlap',
    'Fast and slow clocks', 'Odd days and the day of the week',
    'Leap years and the calendar rule', 'Repeating calendar years',
    'Painted cube problems', 'Cutting a cube into smaller cubes',
    'Dice faces and opposite numbers',
  ],

  // --- aptitude: the rest of the paper --------------------------------------
  'English Language & Comprehension': [
    'Reading comprehension strategy', 'Para jumbles and sentence order',
    'Cloze test and fill in the blanks', 'Error spotting in a sentence',
    'Sentence improvement', 'Synonyms and antonyms', 'Idioms and phrases',
    'One word substitution', 'Active and passive voice', 'Direct and indirect speech',
    'Subject-verb agreement', 'Commonly confused word pairs',
  ],
  'General Awareness & Current Affairs': [
    'How to revise current affairs efficiently', 'Government schemes and their aims',
    'Banking and financial awareness', 'Awards and honours', 'Sports events and winners',
    'Books and their authors', 'Summits and international organisations',
    'Appointments and who holds which post', 'Important days and themes',
    'Budget and economic survey highlights',
  ],
  'Static GK — History, Geography & Polity': [
    'The Indian Constitution and its parts', 'Fundamental rights and duties',
    'Parliament and the legislative process', 'Ancient and medieval India',
    'The freedom struggle and its milestones', 'Indian rivers and their tributaries',
    'Mountain ranges, passes and plateaus', 'National parks and sanctuaries',
    'States, capitals and dances', 'Monuments and who built them',
  ],
  'General Science': [
    'Everyday physics in exam questions', 'Human body systems and their organs',
    'Vitamins, deficiencies and diseases', 'Acids, bases and salts',
    'Metals, non-metals and alloys', 'Plant and animal classification',
    'Units, instruments and what they measure', 'Environment and pollution',
    'Scientific discoveries and who made them',
  ],
  'Computer Awareness': [
    'Computer generations and their hardware', 'Input, output and storage devices',
    'Memory — RAM, ROM and cache', 'Operating systems and their functions',
    'MS Office shortcuts worth knowing', 'Networking and topology basics',
    'The internet, browsers and protocols', 'Databases and file organisation',
    'Cyber security, viruses and safe practice', 'Number systems inside a computer',
  ],
};

/** Suggestions for a subject, or an empty list if it has none. */
export function subtopicsFor(subject: string): string[] {
  return SUBTOPICS[subject] || [];
}
