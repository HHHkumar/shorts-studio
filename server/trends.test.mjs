import { findTrending } from './trends.mjs';
let fails = 0;
const ok = (n, c, extra='') => { console.log((c?'  ok  ':'  FAIL')+'  '+n+(extra?'  '+extra:'')); if(!c) fails++; };

const reply = (text, grounding) => ({
  ok: true, status: 200, headers: new Headers(),
  text: async () => JSON.stringify({ candidates: [{
    content: { parts: [{ text }] },
    groundingMetadata: grounding,
  }] }),
});
const fail = (status, body) => ({ ok:false, status, headers:new Headers(), text: async () => body });

const good = JSON.stringify([
  { topic:'Sodium-ion grid batteries', why:'First large deployments this month.', angle:'Cheaper than lithium but heavier — why grids do not care.', heat:9 },
  { topic:'Perovskite tandem solar record', why:'New efficiency record announced.', angle:'Why 33% is close to a hard physical ceiling.', heat:7 },
]);

// 1. clean JSON + grounding metadata
globalThis.fetch = async () => reply(good, {
  groundingChunks: [
    { web: { uri:'https://example.com/a', title:'Grid storage report' } },
    { web: { uri:'https://example.com/a', title:'duplicate' } },
    { web: { uri:'https://example.com/b', title:'Solar record' } },
  ],
  webSearchQueries: ['sodium ion grid storage 2026', 'perovskite record'],
});
let r = await findTrending('k','gemini-2.5-flash',{ contentType:'general', subject:'Physics' });
ok('parses items', r.items.length === 2, JSON.stringify(r.items[0].topic));
ok('keeps the angle', r.items[0].angle.includes('heavier'));
ok('dedupes sources', r.sources.length === 2, 'sources=' + r.sources.length);
ok('reports the searches', r.searches.length === 2);

// 2. prose-wrapped in a fence
globalThis.fetch = async () => reply('Here is what I found:\n```json\n' + good + '\n```\nHope that helps.', {});
r = await findTrending('k','m',{});
ok('digs JSON out of prose', r.items.length === 2);

// 3. junk fields degrade safely
globalThis.fetch = async () => reply(JSON.stringify([
  { topic:'Fine', why:null, angle:123, heat:'very hot' },
  { topic:'', why:'no topic so dropped' },
  { nonsense:true },
]), {});
r = await findTrending('k','m',{});
ok('drops entries with no topic', r.items.length === 1, 'kept=' + r.items.length);
ok('clamps a bad heat to a number', r.items[0].heat === 5, 'heat=' + r.items[0].heat);

// 4. nothing usable
globalThis.fetch = async () => reply('I could not find anything.', {});
try { await findTrending('k','m',{}); ok('empty result throws', false); }
catch (e) { ok('empty result throws', e.message.includes('Nothing usable')); }

// 5. a model that cannot search
globalThis.fetch = async () => fail(400, JSON.stringify({ error:{ message:'Search tool is not supported for this model.' } }));
try { await findTrending('k','gemini-2.0-flash',{}); ok('names the real cause', false); }
catch (e) { ok('names the real cause', e.message.includes('cannot search the web'), e.message.slice(0,60)); }

// 6. blocked prompt
globalThis.fetch = async () => ({ ok:true, status:200, headers:new Headers(),
  text: async () => JSON.stringify({ promptFeedback: { blockReason: 'SAFETY' } }) });
try { await findTrending('k','m',{}); ok('handles a block', false); }
catch (e) { ok('handles a block', e.message.includes('SAFETY')); }

// 7. the search tool is actually requested
let sent = null;
globalThis.fetch = async (u, init) => { sent = JSON.parse(init.body); return reply(good, {}); };
await findTrending('k','m',{ contentType:'electrical', subject:'Power Generation', exam:'GATE EE' });
ok('asks for google_search', JSON.stringify(sent.tools) === '[{"google_search":{}}]', JSON.stringify(sent.tools));
ok('scopes to the domain', sent.contents[0].parts[0].text.includes('Power Generation'));
ok('no schema alongside tools', !('responseSchema' in sent.generationConfig));

console.log(fails ? '\n' + fails + ' FAILURES' : '\nall trending checks passed');
process.exit(fails ? 1 : 0);
