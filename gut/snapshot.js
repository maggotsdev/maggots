/* Holder snapshot: replays every Transfer of MAGGOTS from launch to now and keeps the balances.
   Usage: node snapshot.js [tokenAddress] [fromBlock]   (defaults from config.json)
   Writes holders.json next to this file: { block, total, eligible, holders: [[address, balance], ...] } */
import fs from 'node:fs';
import path from 'node:path';
import { getAddress, parseUnits } from 'viem';
import { CFG, pub, here, sleep } from './lib.js';

const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
export async function snapshot(token = CFG.maggots.address, fromBlock = CFG.maggots.launchBlock || 0) {
  token = getAddress(token);
  const head = Number(await pub.getBlockNumber());
  if (!fromBlock) { fromBlock = Math.max(0, head - 1_200_000); console.log('no launchBlock in config; scanning the last 1.2M blocks'); }
  const bal = new Map(); let win = 60_000;
  for (let from = fromBlock; from <= head;) {
    const to = Math.min(head, from + win - 1);
    try {
      const logs = await pub.request({ method: 'eth_getLogs', params: [{ address: token, fromBlock: '0x' + from.toString(16), toBlock: '0x' + to.toString(16), topics: [TRANSFER] }] });
      for (const l of logs) {
        const f = getAddress('0x' + l.topics[1].slice(-40)), t = getAddress('0x' + l.topics[2].slice(-40)), v = BigInt(l.data);
        bal.set(f, (bal.get(f) || 0n) - v); bal.set(t, (bal.get(t) || 0n) + v);
      }
      process.stdout.write(`\r${to - fromBlock + 1}/${head - fromBlock + 1} blocks, ${logs.length} transfers in window, ${bal.size} addresses   `);
      from = to + 1; await sleep(250);
    } catch (e) {
      const m = String(e.message || e);
      if (m.includes('10000') || m.includes('limit')) { win = Math.max(2000, Math.floor(win / 2)); continue; }
      if (m.includes('429')) { await sleep(3000); continue; }
      throw e;
    }
  }
  console.log();
  const excl = new Set(CFG.excludeAddresses.map(a => a.toLowerCase())); if (CFG.maggots.poolAddress) excl.add(CFG.maggots.poolAddress.toLowerCase());
  const min = parseUnits(CFG.maggots.totalSupply, CFG.maggots.decimals) * BigInt(Math.round(CFG.minHoldFractionOfSupply * 1e8)) / 100_000_000n;
  const holders = [...bal.entries()].filter(([a, v]) => v > 0n && !excl.has(a.toLowerCase())).sort((x, y) => (y[1] > x[1] ? 1 : -1));
  const eligible = holders.filter(([, v]) => v >= min).slice(0, CFG.maxRecipients);
  const total = holders.reduce((s, [, v]) => s + v, 0n), eligTotal = eligible.reduce((s, [, v]) => s + v, 0n);
  const out = { token, block: head, holders: holders.length, eligible: eligible.length, total: total.toString(), eligibleTotal: eligTotal.toString(), minBalance: min.toString(), list: eligible.map(([a, v]) => [a, v.toString()]) };
  fs.writeFileSync(path.join(here, 'holders.json'), JSON.stringify(out, null, 1));
  console.log(`holders ${holders.length}, eligible ${eligible.length}, block ${head}`);
  return out;
}
if (process.argv[1] && process.argv[1].endsWith('snapshot.js')) snapshot(process.argv[2], process.argv[3] ? Number(process.argv[3]) : undefined).catch(e => { console.error(e); process.exit(1); });
