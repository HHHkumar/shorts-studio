import { fetchRetrying } from './retry.mjs';
let fails = 0;
const ok = (n, c, extra='') => { console.log((c?'  ok  ':'  FAIL')+'  '+n+(extra?'  '+extra:'')); if(!c) fails++; };
const realFetch = globalThis.fetch;

const mock = (statuses, headers = {}) => {
  let i = 0;
  const calls = [];
  globalThis.fetch = async () => {
    const s = statuses[Math.min(i, statuses.length - 1)];
    calls.push(s); i++;
    return { ok: s >= 200 && s < 300, status: s, headers: new Headers(headers), text: async () => '{}' };
  };
  return calls;
};

// 503 twice then success -> should end up ok, after 3 calls
let calls = mock([503, 503, 200]);
let t = Date.now();
let res = await fetchRetrying('https://x', {});
ok('retries 503 then succeeds', res.ok && calls.length === 3, 'calls=' + calls.join(','));
ok('backoff actually waited', Date.now() - t > 2000, (Date.now()-t) + 'ms');

// 503 forever -> gives up and returns the 503, exactly 3 attempts
calls = mock([503]);
res = await fetchRetrying('https://x', {});
ok('gives up after 3 attempts', !res.ok && res.status === 503 && calls.length === 3, 'calls=' + calls.length);

// 400 -> never retried
calls = mock([400]);
res = await fetchRetrying('https://x', {});
ok('does NOT retry 400', res.status === 400 && calls.length === 1, 'calls=' + calls.length);

// 401 -> never retried (a bad key must fail fast)
calls = mock([401]);
res = await fetchRetrying('https://x', {});
ok('does NOT retry 401', res.status === 401 && calls.length === 1, 'calls=' + calls.length);

// 402 no-credit -> never retried, must not burn money
calls = mock([402]);
res = await fetchRetrying('https://x', {});
ok('does NOT retry 402', res.status === 402 && calls.length === 1, 'calls=' + calls.length);

// Retry-After honoured
calls = mock([429, 200], { 'retry-after': '1' });
t = Date.now();
res = await fetchRetrying('https://x', {});
const waited = Date.now() - t;
ok('honours Retry-After', res.ok && waited >= 900 && waited < 2500, waited + 'ms');

// network error then success
let n = 0;
globalThis.fetch = async () => {
  n++;
  if (n === 1) throw new Error('socket hang up');
  return { ok: true, status: 200, headers: new Headers(), text: async () => '{}' };
};
res = await fetchRetrying('https://x', {});
ok('recovers from a dropped connection', res.ok && n === 2, 'calls=' + n);

globalThis.fetch = realFetch;
console.log(fails ? '\n' + fails + ' FAILURES' : '\nall retry checks passed');
process.exit(fails ? 1 : 0);
