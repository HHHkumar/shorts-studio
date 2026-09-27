// Run: node server/planner.test.mjs
//
// The syllabus planner: never repeating a made topic, and the plan on disk.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  coveredTopics, deletePlan, extendPlan, listPlans, planIdFor, PLANNER_SYSTEM, readPlan, tidyItems, updateItem,
} from './planner.mjs';

let passed = 0;
const test = (name, fn) => {
  try {
    fn();
    console.log('  ok  ' + name);
    passed++;
  } catch (err) {
    console.error('  FAIL  ' + name + '\n        ' + err.message);
    process.exitCode = 1;
  }
};
const assert = (cond, message) => { if (!cond) throw new Error(message); };

const item = (topic, extra = {}) => ({ unit: 'Machines', subject: 'Electrical Machines', topic, angle: 'why', difficulty: 'Medium', ...extra });

test('topics already in the library, or the plan, are covered - however they are written', () => {
  const covered = coveredTopics([{ content: { topic: 'Slip in Induction Motors' } }], { items: [{ topic: 'Creeping' }] });
  const out = tidyItems([item('slip in induction motors!'), item('Creeping'), item('Back EMF')], covered, 10);
  assert(out.length === 1 && out[0].topic === 'Back EMF', JSON.stringify(out.map((i) => i.topic)));
});

test('duplicates within one reply are dropped, and the count is respected', () => {
  const out = tidyItems([item('A'), item('a'), item('B'), item('C')], new Set(), 2);
  assert(out.map((i) => i.topic).join() === 'A,B', out.map((i) => i.topic).join());
});

test('each item starts to do, with an id, a known difficulty', () => {
  const [one] = tidyItems([item('Back EMF', { difficulty: 'Brutal' })], new Set(), 5);
  assert(one.status === 'todo' && one.id && one.difficulty === 'Medium', JSON.stringify(one));
});

test('the model is told to avoid what is made and to spread across the syllabus', () => {
  assert(/AVOID list/.test(PLANNER_SYSTEM) && /never more than three/i.test(PLANNER_SYSTEM));
});

test('plans are kept per exam, extended, updated and deleted', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plans-'));
  assert(planIdFor('KPTCL AE / JE') === 'kptcl-ae-je', planIdFor('KPTCL AE / JE'));
  const first = extendPlan(dir, 'KPTCL AE', '', { syllabus: [{ unit: 'Machines', topics: ['Slip'] }], items: tidyItems([item('Slip')], new Set(), 5) });
  extendPlan(dir, 'KPTCL AE', '', { syllabus: [], items: tidyItems([item('Back EMF')], new Set(), 5) });
  const plan = readPlan(dir, first.id);
  assert(plan.items.length === 2 && plan.syllabus.length === 1, 'not extended: ' + JSON.stringify(plan));
  updateItem(dir, plan.id, plan.items[0].id, { status: 'done', videoId: 'v-20260927-100000-abcd' });
  assert(readPlan(dir, plan.id).items[0].status === 'done');
  assert(listPlans(dir).length === 1);
  deletePlan(dir, plan.id);
  assert(listPlans(dir).length === 0);
  let threw = false;
  try { readPlan(dir, '../../etc') ; updateItem(dir, '../x', 'y', {}); } catch { threw = true; }
  assert(threw, 'a path was accepted as a plan id');
  fs.rmSync(dir, { recursive: true, force: true });
});

console.log('\n' + passed + ' checks passed');
