// Bar models against standard aptitude examples.
import { answerBars, barsAskText, layoutBars, normalizeBars, ratioText, solveBars } from './bars.ts';
import { checkFigure, normalizeFigure } from './index.ts';

let fails = 0;
const ok = (n, c, extra = '') => { console.log((c ? '  ok  ' : '  FAIL') + '  ' + n + (extra ? '  ' + extra : '')); if (!c) fails++; };
const near = (a, b, tol = 1e-4) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
const bars = (raw) => {
  const r = normalizeBars({ type: 'bars', ...raw });
  if (!r.figure) console.log('     (refused: ' + r.errors.join('; ') + ')');
  return r.figure;
};
const ans = (raw) => answerBars(bars(raw))?.value;

// --- ratio ---------------------------------------------------------------------------------
const split = { model: 'ratio', money: true, parts: [{ label: 'A', ratio: 3 }, { label: 'B', ratio: 5 }] };
ok('₹800 in 3 : 5 - A gets ₹300', ans({ ...split, total: 800, ask: { quantity: 'share', part: 'A' } }) === 300);
ok('B gets ₹500', ans({ ...split, total: 800, ask: { quantity: 'share', part: 'B' } }) === 500);
ok('from B\'s ₹500 the total is ₹800', ans({ ...split, known: { label: 'B', value: 500 }, ask: 'total' }) === 800);
ok('from B getting ₹200 more than A, A gets ₹300', ans({ ...split, difference: { a: 'B', b: 'A', value: 200 }, ask: { quantity: 'share', part: 'A' } }) === 300);
ok('checks against "₹300"', checkFigure(bars({ ...split, total: 800, ask: { quantity: 'share', part: 'A' } }), '₹300').status === 'match');
ok('the bar is drawn in 3 and 5 equal parts', JSON.stringify(solveBars(bars({ ...split, total: 800, ask: { quantity: 'share', part: 'A' } }), true).rows[0].segments.map((s) => s.value)) === '[3,5]');

// --- percentage ------------------------------------------------------------------------------
ok('500 up 20% then down 10% is 540', near(ans({ model: 'percentage', base: 500, changes: [20, -10], ask: 'final' }), 540));
ok('a net change of +8%', near(ans({ model: 'percentage', base: 500, changes: [20, -10], ask: 'netChange' }), 8));
ok('up 10% then down 10% is a 1% loss, not zero', near(ans({ model: 'percentage', changes: [10, -10], ask: 'netChange' }), -1));
ok('reverse: 540 after +20% and -10% started at 500', near(ans({ model: 'percentage', final: 540, changes: [20, -10], ask: 'base' }), 500));
ok('checks "-1%" against "1% loss"? No number sign in words - compare "-1%"', checkFigure(bars({ model: 'percentage', changes: [10, -10], ask: 'netChange' }), '-1%').status === 'match');

// --- profit and discount ------------------------------------------------------------------------
ok('cost ₹400 at 25% profit sells for ₹500', near(ans({ model: 'profit', costPrice: 400, profitPercent: 25, ask: 'sellingPrice' }), 500));
ok('marked ₹600, sold ₹500: discount 16.67%', near(ans({ model: 'profit', costPrice: 400, profitPercent: 25, markedPrice: 600, ask: 'discountPercent' }), 16.6667));
ok('successive 20% and 10% on ₹1000 sells for ₹720', near(ans({ model: 'profit', markedPrice: 1000, discounts: [20, 10], ask: 'sellingPrice' }), 720));
ok('and is a single discount of 28%', near(ans({ model: 'profit', markedPrice: 1000, discounts: [20, 10], ask: 'discountPercent' }), 28));
ok('cost ₹500, sold ₹450: a 10% loss', near(ans({ model: 'profit', costPrice: 500, sellingPrice: 450, ask: 'profitPercent' }), -10));
ok('cost price back from selling ₹660 at 10% profit: ₹600', near(ans({ model: 'profit', sellingPrice: 660, profitPercent: 10, ask: 'costPrice' }), 600));
ok('marked price for 20% profit after 10% discount on cost 450: ₹600',
   near(ans({ model: 'profit', costPrice: 450, profitPercent: 20, discountPercent: 10, ask: 'markedPrice' }), 600));

// --- interest -------------------------------------------------------------------------------------
const cls = { model: 'interest', principal: 10000, rate: 10, time: 2 };
ok('₹10000 at 10% for 2 years: CI ₹2100', near(ans({ ...cls, ask: 'compoundInterest' }), 2100));
ok('SI ₹2000', near(ans({ ...cls, ask: 'simpleInterest' }), 2000));
ok('the famous difference: ₹100 (= P(R/100)²)', near(ans({ ...cls, ask: 'difference' }), 100));
ok('half-yearly: amount ₹12155.06', near(ans({ ...cls, compounding: 'half-yearly', ask: 'amount' }), 12155.0625));
ok('simple: amount ₹12000', near(ans({ ...cls, compounding: 'simple', ask: 'amount' }), 12000));

// --- work ------------------------------------------------------------------------------------------
ok('A in 12 days and B in 15: together 6.67 days', near(ans({ model: 'work', workers: [{ days: 12 }, { days: 15 }] }), 20 / 3));
ok('with pipe C emptying in 20: 10 days', near(ans({ model: 'work', workers: [{ days: 12 }, { days: 15 }, { days: 20, empties: true }] }), 10));
const w = solveBars(bars({ model: 'work', workers: [{ label: 'A', days: 12 }, { label: 'B', days: 15 }] }), true);
ok('work is counted in LCM units: 60, with A 5 a day and B 4', /= 60 units/.test(w.lines[0]) && w.rows[0].segments[0].value === 5 && w.rows[1].segments[0].value === 4);
ok('checks against "20/3 days"? written as 6.67 days', checkFigure(bars({ model: 'work', workers: [{ days: 12 }, { days: 15 }] }), '6.67 days').status === 'match');

// --- alligation and replacement --------------------------------------------------------------------
const mix = { model: 'alligation', cheaper: { label: '₹20/kg', value: 20 }, dearer: { label: '₹50/kg', value: 50 }, mean: 30, ask: 'ratio' };
ok('₹20 and ₹50 to make ₹30: mix 2 : 1', answerBars(bars(mix)).value === '2 : 1', answerBars(bars(mix)).value);
ok('checks against "2:1"', checkFigure(bars(mix), '2:1').status === 'match');
ok('and not against "1:2"', checkFigure(bars(mix), '1:2').status === 'mismatch');
ok('mean from quantities: 2 kg at 20 with 1 kg at 50 is 30', near(ans({ model: 'alligation', cheaper: { value: 20 }, dearer: { value: 50 }, cheaperQuantity: 2, dearerQuantity: 1, ask: 'mean' }), 30));
ok('ratioText keeps whole numbers: 0.5 : 1.5 is 1 : 3', ratioText(0.5, 1.5) === '1 : 3');
ok('40 L, 4 L drawn off and replaced twice: 32.4 L left', near(ans({ model: 'replacement', volume: 40, removed: 4, times: 2, ask: 'remaining' }), 32.4));
ok('that is 81%', near(ans({ model: 'replacement', volume: 40, removed: 4, times: 2, ask: 'remainingPercent' }), 81));

// --- averages ----------------------------------------------------------------------------------------
ok('average of 12, 15, 18 is 15', ans({ model: 'average', values: [12, 15, 18], ask: 'average' }) === 15);
ok('adding 23 makes it 17', ans({ model: 'average', values: [12, 15, 18], added: 23, ask: 'newAverage' }) === 17);
ok('10 numbers averaging 20 rise to 21 when one is added: it was 31',
   ans({ model: 'average', count: 10, average: 20, newAverage: 21, ask: 'addedValue' }) === 31);

// --- before the reveal ---------------------------------------------------------------------------------
const q = solveBars(bars({ model: 'profit', money: true, costPrice: 400, profitPercent: 25, ask: 'sellingPrice' }), false);
ok('question scene: cost price shown', q.rows[0].label === 'Cost price ₹400', JSON.stringify(q.rows));
ok('question scene: selling price and profit are "?"', q.rows[1].label === 'Selling price ?' && q.rows[1].segments[1].text === 'profit ?', JSON.stringify(q.rows[1]));
const loss = solveBars(bars({ model: 'profit', money: true, costPrice: 500, sellingPrice: 450, ask: 'profitPercent' }), true);
ok('a loss is the gap cut off the cost bar', loss.rows[1].segments[1].text === 'loss ₹50' && loss.rows[1].segments[1].ghost && loss.rows[1].segments[0].value === 450);
const disc = solveBars(bars({ model: 'profit', money: true, costPrice: 400, profitPercent: 25, markedPrice: 600, ask: 'discountPercent' }), true);
ok('the discount is the gap off the marked price, and is what is asked', disc.rows[2].segments[1].text === 'discount ₹100' && disc.rows[2].segments[1].accent);
const rp = solveBars(bars({ model: 'replacement', unit: 'L', volume: 40, removed: 4, times: 8, ask: 'remaining' }), false);
ok('replacement: rounds after the start are "?", and the last round is always drawn', rp.rows.length === 6 && rp.rows[1].segments[0].text === '? L' && rp.rows[5].label === 'After 8' && rp.rows[5].segments[0].accent, JSON.stringify(rp.rows.map((r) => r.label)));
ok('work: an outlet is drawn as an outline', solveBars(bars({ model: 'work', workers: [{ days: 12 }, { days: 20, empties: true }] }), true).rows[1].segments[0].ghost === true);
const rq = solveBars(bars({ ...split, total: 800, ask: { quantity: 'share', part: 'A' } }), false);
ok('ratio question scene: shares are "?", total shown', rq.rows[0].segments.every((s) => s.text.endsWith('?')) && /800/.test(rq.rows[0].label), JSON.stringify(rq.rows[0]));

// --- refusals --------------------------------------------------------------------------------------------
const refused = (label, raw, pattern) => {
  const r = normalizeBars({ type: 'bars', ...raw });
  ok(label, r.figure === null && pattern.test(r.errors.join('; ')), r.errors.join('; '));
};
refused('an unknown model', { model: 'magic' }, /model must be/);
refused('pipes that never fill', { model: 'work', workers: [{ days: 10 }, { days: 10, empties: true }] }, /never finish/);
refused('a share that does not fit the total', { ...split, total: 800, known: { label: 'A', value: 400 }, ask: 'total' }, /does not fit the total/);
refused('a mean outside the two values', { ...mix, mean: 60 }, /between/);
refused('a profit that contradicts the prices', { model: 'profit', costPrice: 400, sellingPrice: 500, profitPercent: 10, ask: 'profitPercent' }, /does not fit/);
refused('a ratio without a total, share or difference', { ...split, ask: { quantity: 'share', part: 'A' } }, /give the total/);
refused('a question the values cannot answer', { model: 'profit', costPrice: 400, ask: 'sellingPrice' }, /cannot be worked out/);
ok('the registry reads it', normalizeFigure('{"type":"bars","model":"average","values":[1,2,3]}').figure?.type === 'bars');

// --- nothing worked out shows before the reveal -------------------------------------------------------------
const pq = solveBars(bars({ model: 'percentage', base: 500, changes: [20, -10], ask: 'final' }), false);
ok('percentage: the step after +20% is "?" too, not 600', pq.rows[1].segments[0].text === '?' && pq.rows[0].segments[0].text === '500');
const iq = solveBars(bars({ ...cls, money: true, ask: 'difference' }), false);
ok('interest: each year\'s growth is "?"', iq.rows.every((r) => r.segments[1].text === '?') && iq.rows[0].segments[0].text === '₹10000');
const wq = solveBars(bars({ model: 'work', workers: [{ label: 'A', days: 12 }, { label: 'B', days: 15 }] }), false);
ok('work: the rates wait for the reveal; the times alone are shown', wq.rows.every((r) => r.segments[0].text.startsWith('?')) && wq.rows[0].label === 'A alone in 12 days', JSON.stringify(wq.rows[0]));
ok('work: hours when the question says hours', /= 6.67 hours$/.test(solveBars(bars({ model: 'work', unit: 'hours', workers: [{ days: 12 }, { days: 15 }] }), true).lines[1]));
const aq = solveBars(bars({ model: 'average', count: 10, average: 20, newAverage: 21, ask: 'addedValue' }), false);
ok('average: count × average is working, so its total is "?"', aq.rows[0].segments[0].text === 'total ?' && !/200/.test(aq.lines.join(' ')), JSON.stringify(aq));

// --- labels -------------------------------------------------------------------------------------------------
const al = solveBars(bars(mix), true);
ok('alligation parts in lowest terms: 2 parts and 1 part', al.rows[0].segments[0].text === '2 parts' && al.rows[1].segments[0].text === '1 part', JSON.stringify(al.rows));
ok('alligation label does not repeat its value', al.rows[0].label === '₹20/kg');
ok('an unnamed alligation value is named with it', solveBars(bars({ ...mix, cheaper: { value: 20 } }), true).rows[0].label === 'cheaper at 20');
const av = solveBars(bars({ model: 'average', values: [12, 15, 18], added: 23, ask: 'newAverage' }), true);
ok('average: the added number has its own bar', av.rows.length === 4 && av.rows[3].label === 'added' && av.rows[3].segments[0].accent);
ok('ratio bars are drawn in blocks', JSON.stringify(solveBars(bars({ ...split, total: 800, ask: 'total' }), true).rows[0].segments.map((sg) => sg.blocks)) === '[3,5]');

// --- what the footer says -------------------------------------------------------------------------------------
const prof = bars({ model: 'profit', money: true, costPrice: 400, profitPercent: 25, markedPrice: 600, ask: 'discountPercent' });
ok('footer asks first', barsAskText(prof, false) === 'Find the discount %', barsAskText(prof, false));
ok('then answers', barsAskText(prof, true) === 'Discount % = 16.7%', barsAskText(prof, true));
const share = bars({ ...split, total: 800, ask: { quantity: 'share', part: 'A' } });
ok('ratio footer: Find: A\'s share, then A\'s share = ₹300', barsAskText(share, false) === "Find: A's share" && barsAskText(share, true) === "A's share = ₹300",
   barsAskText(share, false) + ' | ' + barsAskText(share, true));
ok('net change footer keeps its sign', barsAskText(bars({ model: 'percentage', base: 500, changes: [20, -10], ask: 'netChange' }), true) === 'Net change = +8%');
ok('work footer names the unit', barsAskText(bars({ model: 'work', workers: [{ days: 12 }, { days: 15 }, { days: 20, empties: true }] }), true) === 'Time together = 10 days');
ok('the question scene never shows the answer in the footer', !/540/.test(barsAskText(bars({ model: 'percentage', base: 500, changes: [20, -10], ask: 'final' }), false)));

// --- layout: everything inside the frame, nothing overlapping ---------------------------------------------------
const demos = [
  { ...split, total: 800, ask: { quantity: 'share', part: 'A' } },
  { model: 'ratio', money: true, parts: [{ label: 'Ravi', ratio: 2 }, { label: 'Sita', ratio: 3 }, { label: 'Arun', ratio: 7 }], total: 36000, ask: 'total' },
  { model: 'percentage', base: 500, changes: [20, -10], ask: 'final' },
  { model: 'profit', money: true, costPrice: 400, profitPercent: 25, markedPrice: 600, ask: 'discountPercent' },
  { ...cls, money: true, ask: 'difference' },
  { model: 'interest', money: true, principal: 5000, rate: 8, time: 5, compounding: 'simple', ask: 'amount' },
  { model: 'work', workers: [{ label: 'Pipe A', days: 12 }, { label: 'Pipe B', days: 15 }, { label: 'Outlet C', days: 20, empties: true }], unit: 'hours' },
  mix,
  { model: 'replacement', volume: 40, removed: 4, times: 5, ask: 'remaining' },
  { model: 'average', values: [12, 15, 18, 3, 40, 22, 9, 31, 27, 11, 16, 20], added: 90, ask: 'newAverage' },
];
const boxes = (L) => [
  ...L.rows.flatMap((r) => [
    { ...r.label, h: L.labelFont, what: 'row label ' + r.label.text },
    ...r.segments.filter((sg) => sg.label && sg.label.anchor === 'start').map((sg) => ({ ...sg.label, h: L.labelFont, what: 'outside text ' + sg.text })),
    { x: r.segments[0]?.x ?? 0, y: r.y + r.height, width: r.segments.reduce((t, sg) => t + sg.width, 0), anchor: 'start', h: r.height / 1, what: 'bar ' + r.label.text, bar: true },
  ]),
  ...L.lines.map((ln) => ({ ...ln, h: L.lineFont, what: 'line ' + ln.text })),
];
const rect = (b) => {
  const x0 = b.anchor === 'middle' ? b.x - b.width / 2 : b.anchor === 'end' ? b.x - b.width : b.x;
  // Text boxes run from the cap height to the descender; a bar is exactly its height.
  return b.bar ? { x0, x1: x0 + b.width, y0: b.y - b.h, y1: b.y, what: b.what }
    : { x0, x1: x0 + b.width, y0: b.y - b.h * 0.8, y1: b.y + b.h * 0.2, what: b.what };
};
for (const [W, H, F] of [[940, 940 - 36 * 2.1, 36], [1700, 620 - 32 * 2.1, 32]]) {
  for (const d of demos) {
    for (const reveal of [false, true]) {
      const L = layoutBars(bars(d), reveal, W, H, F);
      const rs = boxes(L).map(rect);
      const out = rs.filter((r) => r.x0 < 0 || r.x1 > W || r.y0 < 0 || r.y1 > H);
      const hits = [];
      for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
        const a = rs[i];
        const c = rs[j];
        if (a.x0 < c.x1 - 1 && c.x0 < a.x1 - 1 && a.y0 < c.y1 - 1 && c.y0 < a.y1 - 1) hits.push(a.what + ' / ' + c.what);
      }
      const inside = L.rows.flatMap((r) => r.segments.filter((sg) => sg.label && sg.label.anchor === 'middle' && sg.label.width > sg.width - 16));
      ok(W + 'x' + Math.round(H) + ' ' + d.model + (reveal ? ' reveal' : ' question') + ': inside the frame, no overlaps',
        !out.length && !hits.length && !inside.length, out.map((r) => 'out: ' + r.what).concat(hits).join('; '));
    }
  }
}

console.log(fails ? '\n' + fails + ' FAILURES' : '\nall bar model checks passed');
process.exit(fails ? 1 : 0);
