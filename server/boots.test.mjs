// Run: node server/boots.test.mjs
//
// The helper imports app TypeScript straight from src/ through Node's own type
// stripping, which wants every import spelled with its extension. A tool run
// with tools/ts-resolve.mjs forgives a missing one; the helper does not, and
// the whole studio fails to start. So the modules the helper loads are loaded
// here exactly as it loads them: plain node, no resolver.
//
// server/index.mjs itself is not imported - it starts listening and opens a
// browser - but everything it pulls in that came from another folder is.

let failed = 0;
const ok = (name, cond, extra = '') => {
  console.log((cond ? '  ok  ' : '  FAIL') + '  ' + name + (extra ? '  ' + extra : ''));
  if (!cond) failed++;
};

for (const [name, path, exported] of [
  ['the Kannada alphabet video', './varnamale.mjs', 'varnamaleStatus'],
  ['History Studio', '../studios/history/server/index.mjs', 'mountHistory'],
  ['the voice', './tts.mjs', 'speak'],
  ['the quiz writer', './gemini.mjs', 'generateContent'],
]) {
  try {
    const mod = await import(path);
    ok(name + ' loads under plain node', typeof mod[exported] === 'function');
  } catch (err) {
    ok(name + ' loads under plain node', false, err && err.message ? err.message.split('\n')[0] : String(err));
  }
}

console.log(failed ? '\n' + failed + ' failed\n' : '\nall passed\n');
process.exit(failed ? 1 : 0);
