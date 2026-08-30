import { normalizeContent, scriptBudget } from './gemini.mjs';
const base = { subject:'S', topic:'T', difficulty:'D', intro:'' };
let fails = 0;
const ok = (name, cond, extra='') => { console.log((cond?'  ok  ':'  FAIL') + '  ' + name + (extra?'  '+extra:'')); if(!cond) fails++; };

// --- decimal options must survive the list-marker stripper ------------------
let r = normalizeContent({ question:'q', options:['9.8 m/s','12.5 m/s','3 m/s','0.5 m/s'], correctIndex:0, script:[] }, base);
ok('decimals preserved', r.options[0]==='9.8 m/s', JSON.stringify(r.options));

// --- genuine list markers still stripped ------------------------------------
r = normalizeContent({ question:'q', options:['A) Twelve','B) Fourteen','1. Red','2. Blue'], correctIndex:0, script:[] }, base);
ok('markers stripped', r.options.join(',')==='Twelve,Fourteen,Red,Blue', r.options.join(','));

// --- distinct fillers --------------------------------------------------------
r = normalizeContent({ question:'q', options:['One'], correctIndex:0, script:[] }, base);
ok('fillers distinct', new Set(r.options).size===4, r.options.join(' | '));

// --- LaTeX unwrap, currency safe --------------------------------------------
r = normalizeContent({ question:'A shirt costs $5 and $x$ is unknown.', options:['a','b','c','d'], correctIndex:0, script:[] }, base);
ok('latex vs currency', r.question==='A shirt costs $5 and x is unknown.', r.question);

// --- scene order + synthesis --------------------------------------------------
r = normalizeContent({ question:'q', options:['The hammer','Jupiter','c','d'], correctIndex:1,
  explanation:['e1','e2'], script:[{kind:'outro',narration:'bye'},{kind:'hook',narration:'hi'}] }, base);
ok('order correct', r.script.map(s=>s.kind).join('>')==='hook>question>options>countdown>answer>explain>explain>outro', r.script.map(s=>s.kind).join('>'));
ok('options wording', r.script.find(s=>s.kind==='options').narration==='Is it the hammer, Jupiter, c, or d?', r.script.find(s=>s.kind==='options').narration);
ok('countdown silent', r.script.find(s=>s.kind==='countdown').narration==='');

// --- intro inserted verbatim --------------------------------------------------
r = normalizeContent({ question:'q', options:['a','b','c','d'], correctIndex:0, script:[] }, {...base, intro:"Hi, it's Hemanth here."});
ok('intro first + verbatim', r.script[0].kind==='intro' && r.script[0].narration==="Hi, it's Hemanth here.");

// --- spoiler guard -------------------------------------------------------------
const spoiler = { kind:'icon', items:[{label:'Venus mystery', symbol:'🪐'}] };
r = normalizeContent({ question:'q', options:['a','b','c','d'], correctIndex:0,
  script:[{kind:'hook',narration:'h',visual:spoiler},{kind:'explain',narration:'e',visual:spoiler}] }, base);
ok('no diagram on hook', r.script.find(s=>s.kind==='hook').visual.kind==='none');
ok('diagram kept on explain', r.script.find(s=>s.kind==='explain').visual.kind==='icon');

// --- sketch validation ----------------------------------------------------------
const sk = (v) => normalizeContent({ question:'q', options:['a','b','c','d'], correctIndex:0,
  script:[{kind:'explain',narration:'e',visual:v}] }, base).script.find(s=>s.kind==='explain').visual;
ok('valid sketch kept', sk({kind:'sketch',sketch:'orbit',params:{count:3,labelA:'Sun'}}).sketch==='orbit');
ok('invented name rejected', sk({kind:'sketch',sketch:'quantum-foam',params:{}}).kind==='none');
ok('junk params stripped', JSON.stringify(sk({kind:'sketch',sketch:'graph',params:{count:'lots',mode:'quadratic',angle:NaN}}).params)==='{"mode":"quadratic"}',
   JSON.stringify(sk({kind:'sketch',sketch:'graph',params:{count:'lots',mode:'quadratic',angle:NaN}}).params));
ok('bars need 2 numbers', sk({kind:'bars',items:[{label:'a',value:1}]}).kind==='none');
ok('compare needs 2 sides', sk({kind:'compare',items:[{label:'a',symbol:'x'}]}).kind==='none');

// --- budget -----------------------------------------------------------------------
const b300 = scriptBudget(300,'landscape'), b45 = scriptBudget(45,'portrait');
ok('300s budget', b300.explainCount===15 && b300.totalWords===780, JSON.stringify(b300));
ok('45s budget', b45.explainCount===2, JSON.stringify(b45));

console.log(fails ? '\n' + fails + ' FAILURES' : '\nall checks passed');
process.exit(fails ? 1 : 0);
