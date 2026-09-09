import fs from 'node:fs';
import { parseJsonLoosely, normalizeContent, rejectedThinking, scriptBudget, thinkingFor } from './gemini.mjs';
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

// --- reading a reply from a model we have never seen ------------------------
// A new model family is the thing most likely to answer in a shape the tool has
// not met. None of this may throw: it either finds the JSON or reports that it
// could not, so a failure names a cause instead of surfacing a raw SyntaxError.
const NL = String.fromCharCode(10);
const FENCE = '```';
const parseCases = [
  ['bare JSON', '{"topic":"x"}'],
  ['a code fence', FENCE + 'json' + NL + '{"topic":"x"}' + NL + FENCE],
  ['a fence with no language', FENCE + NL + '{"topic":"x"}' + NL + FENCE],
  ['a sentence in front', 'Here is the script:' + NL + '{"topic":"x"}'],
  ['trailing commentary', '{"topic":"x"}' + NL + 'Let me know if you want changes.'],
];
for (const [name, input] of parseCases) {
  const got = parseJsonLoosely(input);
  ok('parses ' + name, !!got && got.topic === 'x', JSON.stringify(got));
}
ok('reasoning full of braces does not become the answer',
   (parseJsonLoosely('I should use {a} and {b}. Now the JSON: {"topic":"real"}') || {}).topic === 'real');
ok('unreadable output returns null rather than throwing',
   parseJsonLoosely('I am unable to help with that request.') === null);
ok('an empty reply returns null', parseJsonLoosely('') === null);
ok('a bare array is not mistaken for the object', parseJsonLoosely('[1,2,3]') === null);

// --- keeping a thinking model from thinking itself out of room -------------
// A Gemini 3 Flash spent 87 seconds on a NINETY second script and finished with
// MAX_TOKENS having written no JSON at all: the reasoning and the answer share
// one budget, so the answer never got any.

// These two asserted the bug: they required thinkingLevel at the TOP of the
// config, which is where it was being put and where the API does not accept it.
ok('a 3.x model gets the level knob, nested where the API wants it',
   JSON.stringify(thinkingFor('gemini-3.7-flash')) === '{"thinkingConfig":{"thinkingLevel":"low"}}',
   JSON.stringify(thinkingFor('gemini-3.7-flash')));
ok('a 3 pro model gets it too', !!thinkingFor('gemini-3-pro').thinkingConfig.thinkingLevel);
ok('a 2.5 model gets a budget instead',
   thinkingFor('gemini-2.5-flash').thinkingConfig.thinkingBudget === 8192);
ok('2.5 pro gets a budget', !!thinkingFor('gemini-2.5-pro').thinkingConfig);
ok('an older model gets nothing, because it does not think',
   thinkingFor('gemini-1.5-flash') === null);
ok('an unrecognisable name gets nothing rather than a guess',
   thinkingFor('some-other-model') === null);

// The field is dropped and retried on rejection, so telling the two kinds of
// 400 apart is what stops a real error being retried pointlessly - and stops a
// thinking rejection being reported as a broken key.
ok('a complaint about the thinking field is recognised',
   rejectedThinking('Unknown name "thinkingLevel" at generationConfig'));
ok('a thinkingBudget complaint is recognised',
   rejectedThinking('thinkingBudget is not supported for this model'));
ok('a bad key is NOT mistaken for a thinking problem',
   !rejectedThinking('API key not valid. Please pass a valid API key.'));
ok('a quota error is NOT mistaken for one',
   !rejectedThinking('Resource has been exhausted (e.g. check quota).'));

// --- the request Gemini actually accepts -------------------------------------
// All three of these came from one bug report: every generation failing with
// "Request contains an invalid argument" and nothing saying which argument.
const { matchSketch, fieldViolations } = await import('./gemini.mjs');

// 1. Both thinking knobs live INSIDE thinkingConfig. Spreading `thinkingLevel`
//    straight into generationConfig makes it an unknown field, so every Gemini
//    3 request was rejected on its first attempt and only ever worked because
//    the caller strips the setting and retries.
ok('gemini 3 nests thinkingLevel under thinkingConfig',
   JSON.stringify(thinkingFor('gemini-3.8-flash')) === '{"thinkingConfig":{"thinkingLevel":"low"}}',
   JSON.stringify(thinkingFor('gemini-3.8-flash')));
ok('gemini 2.5 still gets a budget',
   JSON.stringify(thinkingFor('gemini-2.5-flash')) === '{"thinkingConfig":{"thinkingBudget":8192}}');
ok('an older model gets no thinking field at all', thinkingFor('gemini-1.5-flash') === null);
ok('every thinking config is a single generationConfig key',
   ['gemini-3.8-flash','gemini-2.5-pro'].every((mm) => {
     const t = thinkingFor(mm);
     return Object.keys(t).length === 1 && Object.keys(t)[0] === 'thinkingConfig';
   }));

// 2. The schema must not carry a 200-value enum. It did, which is what pushed
//    the response schema past what the API accepts.
const geminiSrc = fs.readFileSync(new URL('./gemini.mjs', import.meta.url), 'utf8');
ok('the sketch field is not an enum in the response schema',
   !/sketch:\s*\{\s*type:\s*'STRING',\s*enum:/.test(geminiSrc));

// 3. Losing the enum means normalizeVisual is the only guard left, so it has to
//    forgive the spellings a model really produces and still refuse inventions.
ok('a real sketch name passes', matchSketch('number-line') === 'number-line');
ok('a spaced spelling is matched', matchSketch('Number Line') === 'number-line');
ok('an underscored spelling is matched', matchSketch('number_line') === 'number-line');
ok('a run-together spelling is matched', matchSketch('numberline') === 'number-line');
ok('an invented name is refused', matchSketch('teleporter') === '');
ok('junk is refused', matchSketch(null) === '' && matchSketch('') === '');

let vis = normalizeContent({ question:'q', options:['a','b','c','d'], correctIndex:0,
  script:[{ kind:'explain', narration:'n', visual:{ kind:'sketch', sketch:'Number Line' } }] }, base);
ok('a loosely spelled sketch survives normalisation',
   vis.script.find((l)=>l.kind==='explain').visual.sketch === 'number-line');
vis = normalizeContent({ question:'q', options:['a','b','c','d'], correctIndex:0,
  script:[{ kind:'explain', narration:'n', visual:{ kind:'sketch', sketch:'teleporter' } }] }, base);
ok('an invented sketch degrades to no diagram',
   vis.script.find((l)=>l.kind==='explain').visual.kind === 'none');

// 4. The reason this took so long to find: Google puts "invalid argument" in
//    the message and the field that failed in error.details, which was dropped.
const badReq = JSON.stringify({ error:{ code:400, message:'Request contains an invalid argument.',
  details:[{ '@type':'type.googleapis.com/google.rpc.BadRequest',
             fieldViolations:[{ field:'generation_config.response_schema', description:'Too many enum values' }] }] } });
ok('the failing field is recovered from error.details',
   /response_schema/.test(fieldViolations(badReq)) && /Too many enum/.test(fieldViolations(badReq)),
   fieldViolations(badReq));
ok('a body with no details yields nothing rather than throwing',
   fieldViolations('{"error":{"message":"x"}}') === '');
ok('unparseable body yields nothing rather than throwing', fieldViolations('<html>') === '');

console.log(fails ? '\n' + fails + ' FAILURES' : '\nall checks passed');
process.exit(fails ? 1 : 0);
