import { ALIGN_OPTIONS, flexAlignFor, resolveAlign, textAlignFor } from './align.ts';

let fails = 0;
const ok = (n, c, extra='') => { console.log((c?'  ok  ':'  FAIL')+'  '+n+(extra?'  '+extra:'')); if(!c) fails++; };

const ids = ALIGN_OPTIONS.map((o) => o.id);
ok('auto, centred and flush left are offered', ['auto', 'center', 'left'].every((i) => ids.includes(i)));
ok('auto is offered first', ids[0] === 'auto');
ok('every option has a label and blurb', ALIGN_OPTIONS.every((o) => o.label && o.blurb));

ok('auto defers to a left look', resolveAlign('auto', 'left') === 'left');
ok('auto defers to a centred look', resolveAlign('auto', 'center') === 'center');
ok('the creator can centre a left look', resolveAlign('center', 'left') === 'center');
ok('the creator can left-align a centred look', resolveAlign('left', 'center') === 'left');
ok('settings saved before this existed defer to the look', resolveAlign(undefined, 'left') === 'left');
ok('an unknown value defers to the look rather than breaking layout',
   resolveAlign('justify', 'center') === 'center');

ok('left text is left', textAlignFor('left') === 'left');
ok('centred text is centred', textAlignFor('center') === 'center');
ok('left flex starts at the edge', flexAlignFor('left') === 'flex-start');
ok('centred flex centres', flexAlignFor('center') === 'center');

console.log(fails ? '\n' + fails + ' FAILURES' : '\nall alignment checks passed');
process.exit(fails ? 1 : 0);
