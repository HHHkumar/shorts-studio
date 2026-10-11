import { normalizeContent } from './gemini.mjs';
let fails = 0;
const ok = (n, c, extra='') => { console.log((c?'  ok  ':'  FAIL')+'  '+n+(extra?'  '+extra:'')); if(!c) fails++; };

// `said` is the scene's narration: a number a picture draws must be one the
// video gives, so a test that draws numbers has to say them.
const vis = (sceneKind, visual, said = 'n') => normalizeContent(
  { question:'q', options:['a','b','c','d'], correctIndex:0,
    script:[{ kind: sceneKind, narration: said, visual }] },
  { subject:'S', topic:'T', difficulty:'D', intro:'' },
).script.find(s => s.kind === sceneKind).visual;

// --- the question scene may now show the setup -------------------------------
ok('question: circuit allowed',
   vis('question', { kind:'sketch', sketch:'circuit', params:{ network:'12 + 6' } },
       'Twelve ohms in series with six ohms.').sketch === 'circuit');
ok('question: formula allowed',
   vis('question', { kind:'formula', formula:'V = I R' }).kind === 'formula');

// --- but never anything that encodes the answer ------------------------------
ok('question: graph BLOCKED (a curve is the answer)',
   vis('question', { kind:'sketch', sketch:'graph', params:{mode:'quadratic'} }).kind === 'none');
ok('question: pie BLOCKED',
   vis('question', { kind:'sketch', sketch:'pie', items:[{label:'a',value:1},{label:'b',value:2}] }).kind === 'none');
ok('question: bars BLOCKED',
   vis('question', { kind:'bars', items:[{label:'a',value:1},{label:'b',value:2}] }).kind === 'none');
ok('question: compare BLOCKED',
   vis('question', { kind:'compare', items:[{label:'a',symbol:'x'},{label:'b',symbol:'y'}] }).kind === 'none');
ok('question: icon BLOCKED (the "Venus mystery" case)',
   vis('question', { kind:'icon', items:[{label:'Venus mystery',symbol:'🪐'}] }).kind === 'none');
// Needs a circuit that survives on its own, or this measures the rule about
// circuits without a network rather than the rule about captions.
ok('question: caption stripped (captions leak answers)',
   vis('question', { kind:'sketch', sketch:'circuit', params:{ network:'12 | 6' },
                     caption:'the answer is 4 ohms' }, 'Twelve ohms beside six ohms.').caption === '');

// --- a circuit nobody described is not drawn ---------------------------------
// The old modes could draw two of the many arrangements a question describes,
// so the model picked the nearest wrong one and the picture contradicted the
// words. No picture is better: the words get checked, the picture gets believed.
ok('circuit with no network refused',
   vis('explain', { kind:'sketch', sketch:'circuit', params:{ labelA:'12 V' } }).kind === 'none');
ok('circuit with a network drawn',
   vis('explain', { kind:'sketch', sketch:'circuit', params:{ network:'(12 | 6) + 2' } },
       'Twelve ohms beside six ohms, then two ohms.').kind === 'sketch');
// A saved script is never put through this again, so it keeps its diagram; a
// new one cannot ask by mode alone, because a mode draws values nobody stated.
ok('circuit with only the old mode is no longer drawn for a new script',
   vis('explain', { kind:'sketch', sketch:'circuit', params:{ mode:'series' } }).kind === 'none');
ok('circuit with values the video never gives is not drawn',
   vis('explain', { kind:'sketch', sketch:'circuit', params:{ network:'10 + 20 + 30' } },
       'A series RLC circuit at resonance.').kind === 'none');

// --- the other pre-reveal scenes stay completely bare ------------------------
for (const k of ['hook','options','countdown','answer']) {
  ok(k + ': still blocked',
     vis(k, { kind:'sketch', sketch:'circuit', params:{} }).kind === 'none');
}

// --- explain keeps everything -------------------------------------------------
ok('explain: graph still allowed',
   vis('explain', { kind:'sketch', sketch:'graph', params:{mode:'log', labelA:'Spacing', labelB:'Voltage'} }).sketch === 'graph');
ok('explain: caption kept',
   vis('explain', { kind:'sketch', sketch:'pie', caption:'Fuel mix',
                    items:[{label:'Coal',value:70},{label:'Solar',value:30}] },
       'Coal gives 70 percent and solar 30.').caption === 'Fuel mix');

// --- the new sketches survive, with their items ------------------------------
const flow = vis('explain', { kind:'sketch', sketch:'block-flow',
  items:[{label:'Boiler'},{label:'Turbine'},{label:'Condenser'},{label:'Pump'}] });
ok('block-flow keeps its stages', flow.items.length === 4, JSON.stringify(flow.items.map(i=>i.label)));
const pie = vis('explain', { kind:'sketch', sketch:'pie',
  items:[{label:'Coal',value:70},{label:'Solar',value:30}] }, 'Coal gives 70 percent and solar 30.');
ok('pie keeps its values', pie.items[0].value === 70);
ok('phasor keeps its angle',
   vis('explain', { kind:'sketch', sketch:'phasor', params:{angle:36, labelA:'V', labelB:'I'} },
       'The current lags by thirty six degrees.').params.angle === 36);
ok('invented sketch still rejected',
   vis('explain', { kind:'sketch', sketch:'not-a-real-one' }).kind === 'none');

// --- formulas are shown whole or not at all ----------------------------------
// A clipped equation is not a shorter fact, it is a false one, stated on screen
// with total confidence and no way for a viewer to know something was cut.
const realFormula = '1 Year = 365 x 24 = 8,760 hours';
ok('a real formula survives intact',
   vis('explain', { kind:'formula', formula: realFormula }).formula === realFormula,
   String(vis('explain', { kind:'formula', formula: realFormula }).formula));

const long40 = 'E = Pmax x LF x T = 100 x 0.6 x 8760 MWh';
ok('a 40 character formula is not cut',
   vis('explain', { kind:'formula', formula: long40 }).formula === long40);

const tooLong = 'E = '.padEnd(70, 'x');
ok('a formula too long for the card is dropped, never truncated',
   vis('explain', { kind:'formula', formula: tooLong }).kind === 'none');

ok('an empty formula is dropped',
   vis('explain', { kind:'formula', formula: '   ' }).kind === 'none');

// --- the same animation must not fill a whole video --------------------------
// A model asked for a diagram on every scene reaches for whichever sketch it
// picked first and reuses it, because it fits well enough and it is already in
// mind. Four scenes of the same circuit reads as an illustration of nothing.
const { dropRepeatedSketches } = await import('./gemini.mjs');

const sk = (name) => ({ kind: 'explain', narration: 'n', visual: { kind: 'sketch', sketch: name } });
const names = (out) => out.map((l) => (l.visual.kind === 'sketch' ? l.visual.sketch : '-')).join(',');

ok('a sketch repeated back to back is dropped',
   names(dropRepeatedSketches([sk('circuit'), sk('circuit')])) === 'circuit,-');
ok('the third outing of a sketch is dropped whatever the gap',
   names(dropRepeatedSketches([sk('pie'), sk('venn'), sk('pie'), sk('venn'), sk('pie')]))
   === 'pie,venn,pie,venn,-');
ok('but a sketch may legitimately come back once',
   names(dropRepeatedSketches([sk('pie'), sk('venn'), sk('pie')])) === 'pie,venn,pie');
ok('different sketches are all kept',
   names(dropRepeatedSketches([sk('a'), sk('b'), sk('c')])) === 'a,b,c');
ok('a dropped diagram degrades to none, never to a wrong one',
   dropRepeatedSketches([sk('circuit'), sk('circuit')])[1].visual.kind === 'none');
ok('scenes without a sketch are untouched',
   dropRepeatedSketches([{ kind: 'hook', visual: { kind: 'formula', formula: 'x' } }])[0].visual.formula === 'x');
ok('a gap resets the run so the next repeat is still caught',
   names(dropRepeatedSketches([sk('a'), { kind: 'hook', visual: { kind: 'none' } }, sk('a')])) === 'a,-,a');
ok('nonsense in does not throw', Array.isArray(dropRepeatedSketches([null, {}, sk('a')])));

console.log(fails ? '\n' + fails + ' FAILURES' : '\nall visual checks passed');
process.exit(fails ? 1 : 0);
