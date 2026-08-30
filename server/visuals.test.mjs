import { normalizeContent } from './gemini.mjs';
let fails = 0;
const ok = (n, c, extra='') => { console.log((c?'  ok  ':'  FAIL')+'  '+n+(extra?'  '+extra:'')); if(!c) fails++; };

const vis = (sceneKind, visual) => normalizeContent(
  { question:'q', options:['a','b','c','d'], correctIndex:0,
    script:[{ kind: sceneKind, narration:'n', visual }] },
  { subject:'S', topic:'T', difficulty:'D', intro:'' },
).script.find(s => s.kind === sceneKind).visual;

// --- the question scene may now show the setup -------------------------------
ok('question: circuit allowed',
   vis('question', { kind:'sketch', sketch:'circuit', params:{mode:'series'} }).sketch === 'circuit');
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
ok('question: caption stripped (captions leak answers)',
   vis('question', { kind:'sketch', sketch:'circuit', caption:'the answer is 4 ohms' }).caption === '');

// --- the other pre-reveal scenes stay completely bare ------------------------
for (const k of ['hook','options','countdown','answer']) {
  ok(k + ': still blocked',
     vis(k, { kind:'sketch', sketch:'circuit', params:{} }).kind === 'none');
}

// --- explain keeps everything -------------------------------------------------
ok('explain: graph still allowed',
   vis('explain', { kind:'sketch', sketch:'graph', params:{mode:'log'} }).sketch === 'graph');
ok('explain: caption kept',
   vis('explain', { kind:'sketch', sketch:'pie', caption:'Fuel mix' }).caption === 'Fuel mix');

// --- the new sketches survive, with their items ------------------------------
const flow = vis('explain', { kind:'sketch', sketch:'block-flow',
  items:[{label:'Boiler'},{label:'Turbine'},{label:'Condenser'},{label:'Pump'}] });
ok('block-flow keeps its stages', flow.items.length === 4, JSON.stringify(flow.items.map(i=>i.label)));
const pie = vis('explain', { kind:'sketch', sketch:'pie',
  items:[{label:'Coal',value:70},{label:'Solar',value:30}] });
ok('pie keeps its values', pie.items[0].value === 70);
ok('phasor keeps its angle',
   vis('explain', { kind:'sketch', sketch:'phasor', params:{angle:36} }).params.angle === 36);
ok('invented sketch still rejected',
   vis('explain', { kind:'sketch', sketch:'not-a-real-one' }).kind === 'none');

console.log(fails ? '\n' + fails + ' FAILURES' : '\nall visual checks passed');
process.exit(fails ? 1 : 0);
