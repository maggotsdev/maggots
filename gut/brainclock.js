/* The gut has its own brain. It runs the same larval connectome the page runs, smells the fly's sells
   from the chain, and says "hungry" when the feeding neurons fire. The gut buys the fly on that signal.
   The amount is fixed by fees; only the timing is reflex. If nothing makes it hungry for maxWaitMin,
   it buys anyway and says so. */
import fs from 'node:fs';
import path from 'node:path';
import { here, CFG, pub, sleep } from './lib.js';

globalThis.window = globalThis;
await import('../site/brain.js');
const Brain = globalThis.Brain;
await Brain.load(JSON.parse(fs.readFileSync(path.join(here, '../site/brain.json'), 'utf8')));

const SWAP = '0x40e9cecb9f5f1f1c5b9c97dec2917b7ee92e57ba5563708daca94dd84ad7112f';
const PM = CFG.uniswap.poolManager;
let last = 0;
function int256(h) { let v = BigInt('0x' + h); if (v >= 1n << 255n) v -= 1n << 256n; return v; }
async function readSells() {
  const head = Number(await pub.getBlockNumber()); if (!last) last = head - 200;
  if (head <= last) return [];
  const logs = await pub.request({ method: 'eth_getLogs', params: [{ address: PM, fromBlock: '0x' + (last + 1).toString(16), toBlock: '0x' + head.toString(16), topics: [SWAP, [CFG.flybrain.usdgPoolId]] }] });
  last = head;
  return logs.map(l => { const a0 = int256(l.data.slice(2, 66)); const amt = CFG.flybrain.flybrainIsCurrency0 ? a0 : int256(l.data.slice(66, 130)); return { kind: amt > 0n ? 'buy' : 'sell', amount: Number((amt < 0n ? -amt : amt) / 10n ** 12n) / 1e6 }; });
}
function frac(set) { const S = Brain.sets[set]; const ls = Brain.lastSpike(); let c = 0; for (const i of S) if (Brain.t - ls[i] < 120) c++; return c / S.length; }

/** Resolves with {reason, waitedMin, meals} when the larva is hungry, or after maxWaitMin. */
export async function waitForHunger(maxWaitMin = 240, log = console.log) {
  const t0 = Date.now(); let meals = 0, sells = 0, stim = [];
  log(`brain clock: 3,013 neurons listening to the fly. max wait ${maxWaitMin} min.`);
  while (Date.now() - t0 < maxWaitMin * 60000) {
    let evs = []; try { evs = await readSells(); } catch (e) { log('chain read failed, retrying: ' + (e.shortMessage || e.message).slice(0, 60)); }
    for (const ev of evs) if (ev.kind === 'sell') { sells++; stim.push({ set: 'smell', s: 1, until: Date.now() + 400 }); stim.push({ set: 'taste', s: 0.9, until: Date.now() + 300 }); }
    // run 4 s of brain per loop, applying live stimuli
    for (let k = 0; k < 200; k++) { const now = Date.now(); stim = stim.filter(s => s.until > now); for (const s of stim) Brain.stimulate(s.set, s.s); Brain.step(20); if (frac('feed') > 0.02) { meals++; if (meals >= 3) return { reason: `hungry: feeding neurons fired ${meals} times after ${sells} fly sells`, waitedMin: (Date.now() - t0) / 60000, meals }; } }
    await sleep(4000);
  }
  return { reason: `not hungry after ${maxWaitMin} min (${sells} fly sells, ${meals} meals). buying anyway.`, waitedMin: maxWaitMin, meals };
}
if (process.argv[1] && process.argv[1].endsWith('brainclock.js')) waitForHunger(Number(process.argv[2] || 10)).then(r => { console.log(r); process.exit(0); });
