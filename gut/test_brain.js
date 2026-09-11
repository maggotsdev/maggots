/* Reflex test for the larval brain. Run: node test_brain.js
   Passes when: (1) the brain is nearly silent at rest, (2) smell + taste reach the feeding neurons,
   (3) the burst dies out, (4) dopamine depresses mushroom-body synapses, (5) no blackout. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
globalThis.window = globalThis;
await import('../site/brain.js');
const Brain = globalThis.Brain;
await Brain.load(JSON.parse(fs.readFileSync(path.join(here, '../site/brain.json'), 'utf8')));
const g = () => Brain.groupFiring();
let ok = true; const check = (name, cond, detail) => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (detail ? '  (' + detail + ')' : '')); if (!cond) ok = false; };

check('loaded 3,013 neurons', Brain.n === 3013, Brain.n);
check('has 431 sensory neurons', Brain.groupN.sens === 431, Brain.groupN.sens);
Brain.step(1000);
const rest = Brain.firingNow(100);
check('nearly silent at rest', rest < 30, rest + ' firing in 100 ms');
Brain.stimulate('smell', 1); Brain.stimulate('taste', 1); Brain.step(60);
const s = g();
check('smell + taste drive sensory neurons', s.sens > 100, s.sens + ' sensory');
check('feeding neurons respond', (s.dSEZ || 0) >= 3, (s.dSEZ || 0) + ' dSEZ');
Brain.step(600);
const after = Brain.firingNow(100);
check('the burst dies out', after < 40, after + ' firing 600 ms later');
Brain.stimulate('reward', 1); Brain.stimulate('smell', 1); Brain.step(200);
check('dopamine depresses KC->MBON synapses', Brain.mb.depressed > 100, Brain.mb.depressed + ' depressed, mean gain ' + Brain.mbGain().toFixed(3));
check('no blackout', Brain.blackouts === 0, Brain.blackouts);
console.log(ok ? '\nall reflexes present.' : '\nsomething is off.');
process.exit(ok ? 0 : 1);
