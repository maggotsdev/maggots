/* One epoch of the gut.
   1. Read the gut wallet's USDG (claimed creator fees).
   2. Split: holders / buyback / keep.
   3. Buy FLYBRAIN with the holders' share, in slices, each slice timed by the brain clock.
   4. Buy MAGGOTS with the buyback share and burn it.
   5. Snapshot holders and drop the FLYBRAIN pro-rata. One transfer per holder.
   6. Write the ledger the page reads.
   Usage: node epoch.js            (real)
          node epoch.js --dry      (no transactions; prints the plan)
          node epoch.js --no-brain (skip the brain clock, buy immediately) */
import { getAddress, formatUnits } from 'viem';
import { CFG, pub, wallet, ERC20, balance, fmt, poolKey, swap, quote, readLedger, writeLedger, sleep } from './lib.js';
import { snapshot } from './snapshot.js';

class ExitSignal extends Error {}
process.on('uncaughtException', e => { if (!(e instanceof ExitSignal)) { console.error(e); process.exitCode = 1; } });
const DRY = process.argv.includes('--dry'), NOBRAIN = process.argv.includes('--no-brain');
let e_claims = [];
const epochId = new Date().toISOString().slice(0, 10);
const ledger = readLedger();
if (ledger.epochs.find(e => e.id === epochId && e.done)) { console.log('epoch', epochId, 'already done'); { process.exitCode = 0; await new Promise(r => setTimeout(r, 300)); throw new ExitSignal(); }; }
const w = DRY ? { account: { address: process.env.GUT_ADDRESS || '0x0000000000000000000000000000000000000000' } } : wallet();
const gut = w.account.address;
const USDG = getAddress(CFG.quote.address), FLY = getAddress(CFG.flybrain.address), MAG = CFG.maggots.address;
const flyKey = poolKey(FLY, USDG, CFG.flybrain.usdgPoolFee, CFG.flybrain.usdgPoolTickSpacing, '0x0000000000000000000000000000000000000000');

if (!DRY) { const { claimAll } = await import('./claim.js'); e_claims = await claimAll(w); }
const usdg = await balance(USDG, gut);
console.log(`epoch ${epochId} · gut ${gut} · USDG ${fmt(usdg, 6)}`);
if (usdg < 1_000_000n) { console.log('less than 1 USDG in the gut. claim creator fees on Pons first.'); { process.exitCode = 0; await new Promise(r => setTimeout(r, 300)); throw new ExitSignal(); }; }
const toHolders = usdg * BigInt(Math.round(CFG.split.holders * 1000)) / 1000n;
const toBuyback = usdg * BigInt(Math.round(CFG.split.buyback * 1000)) / 1000n;
console.log(`plan: ${fmt(toHolders, 6)} USDG → FLYBRAIN for holders, ${fmt(toBuyback, 6)} USDG → MAGGOTS burn, ${fmt(usdg - toHolders - toBuyback, 6)} USDG kept`);
const e = { id: epochId, started: new Date().toISOString(), claims: e_claims, usdg: usdg.toString(), toHolders: toHolders.toString(), toBuyback: toBuyback.toString(), buys: [], burn: null, drop: null, done: false };
ledger.epochs = ledger.epochs.filter(x => x.id !== epochId); ledger.epochs.push(e); if (!DRY) writeLedger(ledger);

// 3. buy the fly in slices, timed by the brain
const slices = Math.max(1, CFG.buySlices || 1); let flyBought = 0n;
for (let i = 0; i < slices; i++) {
  const amt = i === slices - 1 ? toHolders - (toHolders / BigInt(slices)) * BigInt(slices - 1) : toHolders / BigInt(slices);
  let timing = { reason: 'no brain clock', waitedMin: 0 };
  if (!NOBRAIN && !DRY) { const { waitForHunger } = await import('./brainclock.js'); timing = await waitForHunger(Number(CFG.maxWaitMin || 240)); }
  const q = await quote(flyKey, USDG, amt);
  console.log(`slice ${i + 1}/${slices}: ${fmt(amt, 6)} USDG → ~${fmt(q)} FLYBRAIN · ${timing.reason}`);
  if (DRY) continue;
  const r = await swap(w, flyKey, USDG, amt, CFG.slippageBps);
  const got = await balance(FLY, gut) - flyBought; flyBought = await balance(FLY, gut);
  e.buys.push({ slice: i + 1, usdg: amt.toString(), fly: got.toString(), tx: r.hash, reason: timing.reason, at: new Date().toISOString() });
  ledger.buys.push({ epoch: epochId, ...e.buys[e.buys.length - 1] }); writeLedger(ledger);
  console.log('  bought', fmt(got), 'FLYBRAIN', r.hash);
}

// 4. buyback and burn MAGGOTS (only after launch, when the pool is known)
if (MAG && !MAG.startsWith('0x0000') && CFG.maggots.poolFee !== undefined && toBuyback > 0n) {
  const magKey = poolKey(MAG, USDG, CFG.maggots.poolFee, CFG.maggots.poolTickSpacing, CFG.maggots.hooks || '0x0000000000000000000000000000000000000000');
  const q = await quote(magKey, USDG, toBuyback); console.log(`buyback: ${fmt(toBuyback, 6)} USDG → ~${fmt(q)} MAGGOTS, then burn`);
  if (!DRY) { const before = await balance(MAG, gut); const r = await swap(w, magKey, USDG, toBuyback, CFG.slippageBps); const got = await balance(MAG, gut) - before; const h = await w.client.writeContract({ address: getAddress(MAG), abi: ERC20, functionName: 'transfer', args: ['0x000000000000000000000000000000000000dEaD', got] }); await pub.waitForTransactionReceipt({ hash: h }); e.burn = { usdg: toBuyback.toString(), maggots: got.toString(), swapTx: r.hash, burnTx: h }; ledger.totals.maggotsBurned = (BigInt(ledger.totals.maggotsBurned) + got).toString(); writeLedger(ledger); console.log('  burned', fmt(got), 'MAGGOTS', h); }
} else console.log('buyback skipped: MAGGOTS pool not configured yet');

// 5. snapshot and drop
if (!MAG || MAG.startsWith('0x0000')) { console.log('no MAGGOTS address yet: FLYBRAIN stays in the gut until launch.'); e.done = DRY ? false : true; if (!DRY) writeLedger(ledger); { process.exitCode = 0; await new Promise(r => setTimeout(r, 300)); throw new ExitSignal(); }; }
const snap = await snapshot();
const pot = DRY ? await quote(flyKey, USDG, toHolders) : await balance(FLY, gut);
const eligTotal = BigInt(snap.eligibleTotal);
console.log(`drop: ${fmt(pot)} FLYBRAIN to ${snap.eligible} holders (pro-rata over ${fmt(eligTotal)} MAGGOTS)`);
const drops = [];
for (const [addr, balStr] of snap.list) {
  const share = pot * BigInt(balStr) / eligTotal; if (share === 0n) continue;
  if (DRY) { drops.push({ to: addr, fly: share.toString() }); continue; }
  try { const h = await w.client.writeContract({ address: FLY, abi: ERC20, functionName: 'transfer', args: [addr, share] }); drops.push({ to: addr, fly: share.toString(), tx: h }); process.stdout.write(`\r${drops.length}/${snap.eligible} sent   `); }
  catch (err) { drops.push({ to: addr, fly: share.toString(), error: String(err.shortMessage || err.message).slice(0, 80) }); }
}
console.log();
if (DRY) { console.log('dry run. first 5 drops:', drops.slice(0, 5)); { process.exitCode = 0; await new Promise(r => setTimeout(r, 300)); throw new ExitSignal(); }; }
e.drop = { block: snap.block, recipients: drops.filter(d => d.tx).length, fly: pot.toString(), failed: drops.filter(d => d.error).length, at: new Date().toISOString() };
ledger.drops.push({ epoch: epochId, ...e.drop, sample: drops.slice(0, 20) });
ledger.totals.flyDropped = (BigInt(ledger.totals.flyDropped) + pot).toString(); ledger.totals.flyBought = (BigInt(ledger.totals.flyBought) + flyBought).toString();
ledger.totals.usdgClaimed = (BigInt(ledger.totals.usdgClaimed) + usdg).toString(); ledger.totals.recipients = e.drop.recipients;
e.done = true; e.finished = new Date().toISOString(); writeLedger(ledger);
console.log('epoch done. ledger written to', CFG.ledger, '· redeploy the site to publish it.');
