/* Prints what the gut holds and what it has done. Read-only. Usage: node status.js [gutAddress] */
import { getAddress } from 'viem';
import { CFG, balance, fmt, readLedger } from './lib.js';
const gut = process.argv[2] || process.env.GUT_ADDRESS;
if (!gut) { console.log('pass the gut address or set GUT_ADDRESS in .env'); process.exit(1); }
const usdg = await balance(CFG.quote.address, gut), fly = await balance(CFG.flybrain.address, gut);
console.log(`gut ${getAddress(gut)}`);
console.log(`  USDG      ${fmt(usdg, 6)}`);
console.log(`  FLYBRAIN  ${fmt(fly)}`);
const l = readLedger();
console.log(`ledger: ${l.epochs.length} epochs, ${l.buys.length} buys, ${l.drops.length} drops`);
console.log(`  fly bought ${fmt(BigInt(l.totals.flyBought))} · fly dropped ${fmt(BigInt(l.totals.flyDropped))} · maggots burned ${fmt(BigInt(l.totals.maggotsBurned))} · last recipients ${l.totals.recipients}`);
