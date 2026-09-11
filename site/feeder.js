/* ---------------------------------------------------------------------------
   MAGGOTS · the feeder.

   Reads Uniswap v4 Swap events on Robinhood Chain straight from the public
   RPC, in your browser. No server, no API key, no indexer. Each pool we watch
   is a corpse: a fly-meta token whose sells the larva eats.

   PoolManager on Robinhood Chain: 0x8366a39cc670b4001a1121b8f6a443a643e40951
   Swap(bytes32 indexed id, address indexed sender, int128 amount0,
        int128 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick, uint24 fee)
   amount0/amount1 are the swapper's balance deltas: positive = swapper received.
--------------------------------------------------------------------------- */
window.Feeder = (function () {
  const RPC = 'https://rpc.mainnet.chain.robinhood.com';
  const PM = '0x8366a39cc670b4001a1121b8f6a443a643e40951';
  const SWAP = '0x40e9cecb9f5f1f1c5b9c97dec2917b7ee92e57ba5563708daca94dd84ad7112f';
  let pools = [];          // {name, id, tokenIs0 (bool), decimals}
  let lastBlock = 0, head = 0, timer = null, listeners = [], errors = 0;
  const stats = { buys: 0, sells: 0, volumeTok: 0, polls: 0 };

  async function rpc(method, params) {
    const r = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
    const j = await r.json(); if (j.error) throw new Error(j.error.message); return j.result;
  }
  function int256(hex) { let v = BigInt('0x' + hex); if (v >= (1n << 255n)) v -= (1n << 256n); return v; }   // int128 values are sign-extended to a 32-byte word
  function decode(log) {
    const d = log.data.slice(2);
    const a0 = int256(d.slice(0, 64)), a1 = int256(d.slice(64, 128));
    const pool = pools.find(p => p.id.toLowerCase() === log.topics[1].toLowerCase()); if (!pool) return null;
    const tokAmt = pool.tokenIs0 ? a0 : a1;                    // swapper's delta in the meme token
    const kind = tokAmt > 0n ? 'buy' : 'sell';                  // received token = buy
    const amount = Number((tokAmt < 0n ? -tokAmt : tokAmt) / (10n ** BigInt(pool.decimals - 6))) / 1e6;
    return { pool: pool.name, via: pool.pool || 'pool', kind, amount, block: parseInt(log.blockNumber, 16), tx: log.transactionHash, sender: '0x' + log.topics[2].slice(-40) };
  }
  async function poll() {
    try {
      head = parseInt(await rpc('eth_blockNumber', []), 16);
      if (!lastBlock) lastBlock = head - 1500;                  // backfill a few minutes on first load
      if (head <= lastBlock) return;
      const from = lastBlock + 1, to = Math.min(head, lastBlock + 4000);
      const logs = await rpc('eth_getLogs', [{ fromBlock: '0x' + from.toString(16), toBlock: '0x' + to.toString(16), address: PM, topics: [SWAP, pools.map(p => p.id)] }]);
      lastBlock = to; stats.polls++; errors = 0;
      for (const l of logs) { const ev = decode(l); if (!ev) continue; if (ev.kind === 'buy') stats.buys++; else stats.sells++; stats.volumeTok += ev.amount; listeners.forEach(f => f(ev)); }
    } catch (e) { errors++; listeners.forEach(f => f({ kind: 'error', message: String(e.message || e) })); }
  }
  function start(cfg) { pools = cfg.pools; if (timer) clearInterval(timer); poll(); timer = setInterval(poll, cfg.intervalMs || 4000); }
  function on(f) { listeners.push(f); }
  return { start, on, stats, get head() { return head; }, get lastBlock() { return lastBlock; }, get errors() { return errors; }, rpc, RPC };
})();
