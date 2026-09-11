/* MAGGOTS · page runtime: hero cloud, brain loop, feeder wiring, rig rendering, brood plate, wallet. */
const CONFIG = {
  brainUrl: 'brain.json',
  // FLYBRAIN trades in two pools. Both are the corpse.
  feeds: [
    { name: 'FLYBRAIN', pool: 'USDG',  id: '0x6191331ead43b8876ea312020ca58e539c51ef48021b3b93fac2718893c0b771', tokenIs0: true,  decimals: 18, bigSell: 2000000 },
    { name: 'FLYBRAIN', pool: 'GOOGL', id: '0x6f638b29e275cab8f584df0a4c6a045922217aed8747f2459eedb034abb31ac7', tokenIs0: false, decimals: 18, bigSell: 2000000 },
  ],
  token: null,            // {name:'MAGGOTS', id:'0x…poolId', tokenIs0:true, decimals:18, address:'0x…'} after launch
  swarmUrl: 'wss://maggots-brood-3013.maggots.workers.dev/room',   // presence server, live
  swarmDemo: false,
  gut: { address: '0x30772292EC56c636D6bD0Bd3994794e133813870' },   // the gut wallet, public
  explorer: 'https://robinhoodchain.blockscout.com',
};
const $ = id => document.getElementById(id);
const dpr = () => Math.min(devicePixelRatio || 1, 2);
function fitCanvas(c) { const d = dpr(), r = c.getBoundingClientRect(); c.width = Math.max(2, r.width * d); c.height = Math.max(2, r.height * d); return c.getContext('2d'); }

/* ---------- hero point cloud ---------- */
const N = 12000;
function gauss() { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function buildLarva(n) {
  const P = new Float32Array(n * 4), R = Math.random; let i = 0;
  const put = (x, y, z, seg) => { if (i >= n) return; P[i * 4] = x; P[i * 4 + 1] = y; P[i * 4 + 2] = z; P[i * 4 + 3] = seg; i++; };
  const body = Math.floor(n * 0.9);
  for (let j = 0; j < body; j++) { const t = R(), cx = -1 + 2 * t; const rad = (0.30 * Math.sin(Math.PI * (0.06 + 0.88 * t)) + 0.04) * (1 + 0.07 * Math.cos(t * Math.PI * 11)); let y = gauss(), z = gauss(); const d = Math.hypot(y, z) || 1; y /= d; z /= d; const r = 0.82 + 0.18 * R(); put(cx, y * rad * r, z * rad * r, Math.floor(t * 11)); }
  for (const sgn of [1, -1]) { const k = Math.floor(n * 0.02); for (let j = 0; j < k; j++) { const t = R(); put(1.02 + t * 0.14, sgn * (0.02 + t * 0.05), (R() - 0.5) * 0.03, 99); } }
  for (const sgn of [1, -1]) { const k = Math.floor(n * 0.01); for (let j = 0; j < k; j++) put(-1.02 - R() * 0.05, sgn * 0.05 + gauss() * 0.012, gauss() * 0.012, 98); }
  while (i < n) put(gauss() * 0.5, gauss() * 0.1, gauss() * 0.1, 5);
  return P;
}
const LARVA = buildLarva(N), heat = new Float32Array(N);
const POSE = { turn: 0, hunch: 0, roll: 0, fwd: 0, feed: 0 };   // set by the brain each frame
(function hero() {
  const cv = $('larva'), cx = cv.getContext('2d', { alpha: false });
  let t = 0, pointer = 0, target = 0;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function fit() { cv.width = Math.max(2, Math.floor(cv.getBoundingClientRect().width * dpr())); cv.height = Math.max(2, Math.floor(cv.getBoundingClientRect().height * dpr())); }
  addEventListener('resize', fit); addEventListener('pointermove', e => { target = (e.clientX / innerWidth - 0.5) * 0.5; });
  cv.addEventListener('click', () => { poke(); });
  function draw() {
    const W = cv.width, H = cv.height; cx.fillStyle = '#06070a'; cx.fillRect(0, 0, W, H);
    pointer += (target - pointer) * 0.04;
    const ang = Math.sin(t * 0.17) * 0.28 + pointer + POSE.turn * 0.6, ct = Math.cos(ang), st = Math.sin(ang);
    const S = Math.min(W * 0.80, H * 1.25) * 0.36 * (1 - POSE.hunch * 0.12), bob = reduced ? 0 : Math.sin(t * 0.7) * H * 0.008;
    const cyOff = H * (innerWidth < 640 ? 0.50 : 0.40), d = dpr();
    const rollA = POSE.roll * t * 2, cr = Math.cos(rollA), sr = Math.sin(rollA);
    for (let i = 0; i < N; i++) {
      const seg = LARVA[i * 4 + 3]; const ph = seg < 90 ? seg * 0.55 : 0; const sq = reduced ? 1 : (1 + (0.09 + POSE.fwd * 0.08) * Math.sin(t * (2.2 + POSE.fwd * 2) - ph));
      let ax = LARVA[i * 4], ay = LARVA[i * 4 + 2] * sq, az = -LARVA[i * 4 + 1] * sq;
      if (POSE.roll > 0.05) { const y2 = ay * cr - az * sr, z2 = ay * sr + az * cr; ay = y2; az = z2; }
      if (seg === 99) ax += POSE.feed * 0.06 * Math.sin(t * 12);
      const wiggle = reduced ? 0 : Math.sin(t * 1.1 + ax * 2.2) * 0.06;
      const dx = ax * ct - ay * st, dz = ax * st + ay * ct;
      const X = W / 2 - dx * S, Y = cyOff + (az + wiggle) * S + bob, depth = (dz + 1) * 0.5, h = heat[i];
      cx.globalAlpha = Math.min(1, 0.22 + depth * 0.55 + h * 0.9);
      cx.fillStyle = seg >= 98 ? '#8a7a5a' : (h > 0.25 ? '#fff4cf' : (depth > 0.58 ? '#f3e9cf' : '#b9ad8e'));
      cx.fillRect(X, Y, (0.62 + depth * 0.95 + h * 1.6) * d, (0.62 + depth * 0.95 + h * 1.6) * d);
      if (h > 0) heat[i] = h - 0.022;
    }
    cx.globalAlpha = 1;
    if (!reduced) { t += 0.016; for (let k = 0; k < 10 + POSE.feed * 60; k++) heat[(Math.random() * N) | 0] = 0.3 + Math.random() * 0.5; }
    requestAnimationFrame(draw);
  }
  fit(); for (let k = 0; k < 300; k++) heat[(Math.random() * N) | 0] = Math.random() * 0.5; draw();
})();

/* ---------- clocks ---------- */
setInterval(() => { $('utc').textContent = new Date().toISOString().slice(11, 19) + ' UTC'; }, 1000);

/* ---------- event log ---------- */
const log = $('r-events');
function push(html, cls) { const d = document.createElement('div'); if (cls) d.className = cls; d.innerHTML = '<b>' + new Date().toISOString().slice(11, 19) + '</b>' + html; log.prepend(d); while (log.children.length > 60) log.lastChild.remove(); }

/* ---------- brain loop ---------- */
const stimuli = [];                                  // {set, strength, until}
function stimulate(set, strength, ms) { stimuli.push({ set, strength, until: performance.now() + ms }); }
function poke() { stimulate('touch', 1.2, 120); push('touched. 179 mechanosensory neurons.', ''); }
const counters = { meals: 0, sells: 0, buys: 0 };
let brainReady = false, lastFrame = 0, machinePerBrain = 1;
const BARS_DN = [['fwd', 'crawl fwd'], ['back', 'crawl back'], ['turnL', 'turn L'], ['turnR', 'turn R'], ['hunch', 'hunch'], ['roll', 'roll']];
const BARS_OUT = [['feed', 'feed'], ['fwd', 'crawl'], ['turnL', 'turn'], ['hunch', 'hunch'], ['roll', 'roll']];
function bars(el, list) { el.innerHTML = list.map(([k, l]) => `<div class="trow"><span class="tn">${l}</span><span class="tt"><span class="tf" id="bar-${el.id}-${k}"></span></span><span class="tv" id="val-${el.id}-${k}">0</span></div>`).join(''); }
bars($('n-dn'), BARS_DN); bars($('n-out'), BARS_OUT);
const sparkCtx = fitCanvas($('n-spark')), scatCtx = fitCanvas($('n-scatter')), sensCtx = fitCanvas($('n-senses')), viewCtx = fitCanvas($('r-view'));
addEventListener('resize', () => { fitCanvas($('n-spark')); fitCanvas($('n-scatter')); fitCanvas($('n-senses')); fitCanvas($('r-view')); });
let sensOrder = null;

function setFrac(el, k, frac, val) { const b = $('bar-' + el + '-' + k), v = $('val-' + el + '-' + k); if (b) b.style.width = Math.min(100, frac * 100).toFixed(0) + '%'; if (v) v.textContent = val; }
function groupFrac(set, win = 100) { const S = Brain.sets[set]; if (!S || !S.length) return 0; const ls = Brain.lastSpike(), t = Brain.t; let c = 0; for (const i of S) if (t - ls[i] < win) c++; return c / S.length; }

// the brain runs on a timer so it keeps living when the tab is hidden; the panel draws on animation frames
let lastRender = 0;
function frame(now) {
  if (!brainReady) return;
  const dt = Math.min(60, now - (lastFrame || now)); lastFrame = now;
  // stimuli
  const live = stimuli.filter(s => s.until > now); stimuli.length = 0; stimuli.push(...live);
  for (const s of live) Brain.stimulate(s.set, s.strength);
  const t0 = performance.now(); const steps = Math.max(1, Math.round(dt)); Brain.step(steps); const ms = performance.now() - t0;
  machinePerBrain = machinePerBrain * 0.9 + (ms / steps) * 0.1;
  // pose from descending groups
  const f = k => groupFrac(k, 120);
  POSE.turn += ((f('turnR') - f('turnL')) * 3 - POSE.turn) * 0.05; POSE.hunch += (f('hunch') * 4 - POSE.hunch) * 0.08;
  POSE.roll += (f('roll') * 3 - POSE.roll) * 0.05; POSE.fwd += (f('fwd') * 4 - POSE.fwd) * 0.05; POSE.feed += (f('feed') * 5 - POSE.feed) * 0.1;
  // the plate: smell and light into the paper's own sensory neurons, descending neurons into motion
  const ate = Arena.tick(dt, f);
  if (ate) { counters.meals++; push('ate on ' + ate.corpse + '. ' + ate.feeding + ' feeding neurons fired.', 'ok'); }
}
function renderTick() { if (!brainReady) return; const now = performance.now(); lastRender = now; try { render(now); } catch (e) { console.error(e); } }
function render(now) {
  const g = Brain.groupFiring(), d = dpr();
  $('n-firing').textContent = Brain.firingNow(100).toLocaleString('en-US');
  $('n-spikes').textContent = Math.round(Brain.spikesPerSec()).toLocaleString('en-US');
  $('n-mv').textContent = Brain.meanV().toFixed(1) + ' mV';
  $('n-sens').textContent = g.sens; $('n-desc').textContent = (g.dVNC || 0) + (g.dSEZ || 0);
  $('r-steps').textContent = Brain.steps.toLocaleString('en-US'); $('r-blackouts').textContent = Brain.blackouts;
  $('r-meals').textContent = counters.meals; $('r-sells').textContent = counters.sells; $('r-buys').textContent = counters.buys;
  $('l-dep').textContent = Brain.mb.depressed.toLocaleString('en-US') + ' / ' + Brain.mb.edges.length.toLocaleString('en-US');
  $('l-gain').textContent = Brain.mbGain().toFixed(4); $('l-rew').textContent = Brain.mb.rewards; $('l-pun').textContent = Brain.mb.punishments;
  $('s-smell').textContent = Math.round(groupFrac('smell') * 100) + '%'; $('s-taste').textContent = Math.round(groupFrac('taste') * 100) + '%'; $('s-light').textContent = Math.round(groupFrac('light') * 100) + '%';
  $('r-fps').textContent = machinePerBrain.toFixed(2) + ' machine ms / brain ms';
  for (const [k] of BARS_DN) { const fr = groupFrac(k, 120); setFrac('n-dn', k, fr * 2.5, Math.round(fr * Brain.sets[k].length)); }
  for (const [k] of BARS_OUT) { const fr = groupFrac(k, 120); setFrac('n-out', k, fr * 2.5, fr.toFixed(2)); }
  // sparkline
  const sc = $('n-spark'), rs = Brain.recent(); sparkCtx.fillStyle = '#000'; sparkCtx.fillRect(0, 0, sc.width, sc.height); sparkCtx.strokeStyle = '#3dff88'; sparkCtx.lineWidth = d; sparkCtx.beginPath();
  const mx = Math.max(40, ...rs); rs.forEach((v, i) => { const x = i / rs.length * sc.width, y = sc.height - 2 - (v / mx) * (sc.height - 4); i ? sparkCtx.lineTo(x, y) : sparkCtx.moveTo(x, y); }); sparkCtx.stroke();
  // scatter
  const xc = $('n-scatter'), lx = Brain.lx(), ly = Brain.ly(), ls = Brain.lastSpike(), col = Brain.color(), t = Brain.t;
  scatCtx.fillStyle = '#000'; scatCtx.fillRect(0, 0, xc.width, xc.height);
  for (let i = 0; i < Brain.n; i++) { const lit = t - ls[i] < 80; scatCtx.fillStyle = lit ? '#3dff88' : '#0f2a19'; const s = lit ? 2 * d : d; scatCtx.fillRect(lx[i] * xc.width, ly[i] * xc.height, s, s); }
  // senses grid: columns by modality
  if (!sensOrder) { sensOrder = []; for (const k of ['smell', 'light', 'warm', 'taste', 'touch']) for (const i of Brain.sets[k]) sensOrder.push([i, k]); }
  const sx = $('n-senses'); sensCtx.fillStyle = '#000'; sensCtx.fillRect(0, 0, sx.width, sx.height);
  const cols = Math.ceil(Math.sqrt(sensOrder.length * (sx.width / sx.height))), cw = sx.width / cols, ch = sx.height / Math.ceil(sensOrder.length / cols);
  sensOrder.forEach(([i, k], j) => { const lit = t - ls[i] < 80; sensCtx.fillStyle = lit ? (k === 'light' ? '#dceef8' : '#3dff88') : '#0a1f12'; sensCtx.fillRect((j % cols) * cw + 0.5, Math.floor(j / cols) * ch + 0.5, Math.max(1, cw - 1), Math.max(1, ch - 1)); });
  // the plate
  Arena.draw(viewCtx, $('r-view'), LARVA, N, POSE, d);
  if (audio.on) audio.tick(Brain.recent());
}

/* ---------- feeder wiring: the public map ---------- */
function onTrade(ev) {
  if (ev.kind === 'error') { $('p-feeder').className = 'pip2 off'; if (Feeder.errors === 1) push('chain read failed: ' + ev.message.slice(0, 60), 'blk'); return; }
  $('p-feeder').className = 'pip2 on';
  const big = ev.amount >= (CONFIG.feeds[0].bigSell || 1e9), amt = ev.amount >= 1e6 ? (ev.amount / 1e6).toFixed(2) + 'M' : ev.amount >= 1e3 ? (ev.amount / 1e3).toFixed(1) + 'K' : ev.amount.toFixed(0);
  if (ev.pool === 'FLYBRAIN') {
    if (ev.kind === 'sell') { counters.sells++; Arena.onTrade(ev); if (big) stimulate('reward', 1, 150); push(`FLYBRAIN sell ${amt} <span class="tdim">(${ev.via})</span> → smell rises on the plate${big ? ' + dopamine' : ''} <span class="tdim">${ev.tx.slice(0, 10)}</span>`, big ? 'ok' : ''); }
    else { counters.buys++; Arena.onTrade(ev); push(`FLYBRAIN buy ${amt} <span class="tdim">(${ev.via})</span> → the corpse flashes with light <span class="tdim">${ev.tx.slice(0, 10)}</span>`, 'veto'); }
  } else if (ev.pool === 'MAGGOTS') {
    if (ev.kind === 'buy') { stimulate('taste', 1, 300); stimulate('reward', 1, 150); push(`MAGGOTS buy ${amt} → taste + dopamine`, 'ok'); }
    else { stimulate('touch', big ? 1.5 : 1, 200); if (big) stimulate('punish', 1, 150); push(`MAGGOTS sell ${amt} → touch${big ? ' + punishment' : ''}`, 'blk'); }
  }
}
setInterval(() => { if (Feeder.head) $('blk').textContent = Feeder.head.toLocaleString('en-US'); }, 2000);

/* ---------- sound: every click is a spike ---------- */
const audio = { on: false, ctx: null, tick(recent) { if (!this.ctx) return; const n = Math.min(recent.length, 100); let sp = 0; for (let i = recent.length - n; i < recent.length; i++) sp += recent[i]; const k = Math.min(28, Math.round(sp / 6)); const now = this.ctx.currentTime; for (let i = 0; i < k; i++) { const o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = 'square'; o.frequency.value = 900 + Math.random() * 1800; g.gain.value = 0.0001; o.connect(g); g.connect(this.ctx.destination); const at = now + Math.random() * 0.1; g.gain.setValueAtTime(0.03, at); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.012); o.start(at); o.stop(at + 0.02); } } };
$('p-listen').addEventListener('click', () => { if (!audio.ctx) audio.ctx = new (window.AudioContext || window.webkitAudioContext)(); audio.on = !audio.on; if (audio.on) audio.ctx.resume(); $('p-listen').className = 'pip2 ' + (audio.on ? 'on' : ''); $('p-listen').textContent = audio.on ? 'LISTENING' : 'LISTEN'; });

/* ---------- the plate: corpses ---------- */
Arena.addSource('FLYBRAIN', 0.72, 0.42);

/* ---------- the gut: ledger + live balances ---------- */
(async function gut() {
  const G = CONFIG.gut || {}; if (G.address) { $('g-addr').textContent = G.address; }
  let L = null; try { L = await (await fetch('gut-ledger.json?t=' + Date.now())).json(); } catch (e) { }
  const f18 = v => (Number(BigInt(v) / 10n ** 12n) / 1e6).toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (L) {
    $('g-bought').textContent = f18(L.totals.flyBought) + ' FLYBRAIN'; $('g-dropped').textContent = f18(L.totals.flyDropped) + ' FLYBRAIN to ' + L.totals.recipients + ' wallets';
    $('g-burned').textContent = f18(L.totals.maggotsBurned) + ' MAGGOTS';
    const last = L.drops[L.drops.length - 1]; $('g-last').textContent = last ? (last.at.slice(0, 16).replace('T', ' ') + ' UTC · ' + f18(last.fly) + ' fly to ' + last.recipients + ' wallets') : 'none yet';
    const tb = $('g-buys'); for (const b of L.buys.slice(-8).reverse()) { const tr = document.createElement('tr'); tr.innerHTML = `<td class="num">${b.at.slice(5, 16).replace('T', ' ')}</td><td class="num">${(Number(b.usdg) / 1e6).toFixed(2)}</td><td class="num">${f18(b.fly)}</td><td>${b.reason}</td><td class="addr"><a href="${CONFIG.explorer || 'https://robinhoodchain.blockscout.com'}/tx/${b.tx}">${b.tx.slice(0, 10)}…</a></td>`; tb.appendChild(tr); }
    if (!L.buys.length) { const tr = document.createElement('tr'); tr.innerHTML = '<td colspan="5" style="color:var(--ink-faint)">no buys yet. the gut fills at launch.</td>'; tb.appendChild(tr); }
  } else { $('g-bought').textContent = 'ledger not published yet'; }
  async function balances() {
    if (!G.address) return;
    const bal = async (tok, who) => BigInt(await Feeder.rpc('eth_call', [{ to: tok, data: '0x70a08231' + who.slice(2).padStart(64, '0') }, 'latest']));
    try { const u = await bal('0x5fc5360d0400a0fd4f2af552add042d716f1d168', G.address), fl = await bal('0x4eb990547bce4a982432ca88cf5fae7eed1a2d35', G.address); $('g-hold').textContent = (Number(u) / 1e6).toFixed(2) + ' USDG · ' + f18(fl) + ' FLYBRAIN'; } catch (e) { }
  }
  balances(); setInterval(balances, 30000);
  window.gutShare = async function (addr) {   // called after wallet connect
    if (!G.address || !CONFIG.token || !CONFIG.token.address) { $('g-you').textContent = 'shows after launch'; return; }
    try { const bal = async (tok, who) => BigInt(await Feeder.rpc('eth_call', [{ to: tok, data: '0x70a08231' + who.slice(2).padStart(64, '0') }, 'latest'])); const mine = await bal(CONFIG.token.address, addr); const supply = BigInt(await Feeder.rpc('eth_call', [{ to: CONFIG.token.address, data: '0x18160ddd' }, 'latest'])); const u = await bal('0x5fc5360d0400a0fd4f2af552add042d716f1d168', G.address); const pot = Number(u) / 1e6 * 0.7; const share = Number(mine * 1000000n / supply) / 1e6; $('g-you').textContent = (share * 100).toFixed(4) + '% of holders\u2019 share · about $' + (pot * share).toFixed(2) + ' of fly if the gut dropped now'; } catch (e) { $('g-you').textContent = 'could not read'; }
  };
})();

/* ---------- copy ---------- */
$('copy').addEventListener('click', async () => { const b = $('copy'); try { await navigator.clipboard.writeText($('ca').textContent.trim()); b.textContent = 'Copied'; } catch (e) { b.textContent = 'Select it'; } setTimeout(() => b.textContent = 'Copy', 1600); });

/* ---------- the brood (presence) ---------- */
(function brood() {
  const cv = $('plate'), cx = cv.getContext('2d', { alpha: false }); let t = 0, left = 0, hov = null;
  function fit() { cv.width = cv.getBoundingClientRect().width * dpr(); cv.height = cv.getBoundingClientRect().height * dpr(); } fit(); addEventListener('resize', fit);
  const SH = (() => { const n = 420, P = new Float32Array(n * 3); for (let j = 0; j < n; j++) { const tt = Math.random(); const rad = (0.30 * Math.sin(Math.PI * (0.06 + 0.88 * tt)) + 0.04) * (1 + 0.07 * Math.cos(tt * Math.PI * 11)); let y = gauss(), z = gauss(); const d = Math.hypot(y, z) || 1; y /= d; z /= d; const r = 0.82 + 0.18 * Math.random(); P[j * 3] = -1 + 2 * tt; P[j * 3 + 1] = y * rad * r; P[j * 3 + 2] = z * rad * r; } return P; })();
  const names = ['anon', 'larva_enjoyer', 'not_a_fly', 'gertrude', 'agar', 'hooks', 'banana', 'dnp13', 'kolmogorov', 'ponswatch', 'maxxing', 'lena', '0x6c…b42a', '0x49…24c5'];
  const M = [];
  function spawn(you, id) { const m = { id: you ? 'you' : (id || names[(Math.random() * names.length) | 0] + '_' + ((Math.random() * 99) | 0)), x: .12 + Math.random() * .76, y: .15 + Math.random() * .7, a: Math.random() * 6.28, size: you ? 1.2 : .6 + Math.random() * 1.1, ph: Math.random() * 6, you: !!you, born: Date.now() }; M.push(m); return m; }
  const me = spawn(true);
  if (CONFIG.swarmDemo && !CONFIG.swarmUrl) { for (let i = 0; i < 12; i++) spawn(false); setInterval(() => { if (Math.random() < .55 && M.length < 34) spawn(false); else if (M.length > 6) { const i = 1 + ((Math.random() * (M.length - 1)) | 0); M.splice(i, 1); left++; } }, 2800); }
  else if (CONFIG.swarmUrl) {
    // live presence: the roster from the room replaces the demo maggots; yours stays yours
    let ws, myId = null;
    function connect() {
      ws = new WebSocket(CONFIG.swarmUrl);
      ws.onopen = () => { $('sw-mode').innerHTML = '&#9679; live'; $('sw-note').textContent = 'Presence is live. Every maggot on the plate is a real open tab.'; ws.send(JSON.stringify({ name: me.id, size: me.size })); };
      ws.onmessage = ev => {
        const m = JSON.parse(ev.data); if (m.you) { myId = m.you; return; }
        if (!m.roster) return;
        const seen = new Set();
        for (const p of m.roster) { if (p.id === myId) continue; seen.add(p.id); let x = M.find(q => q.id === p.id); if (!x) { x = spawn(false, p.id); x.label = p.wallet || p.name; x.born = p.born; } x.size = p.size; x.label = p.wallet || p.name; }
        for (let i = M.length - 1; i >= 0; i--) if (!M[i].you && !seen.has(M[i].id)) { M.splice(i, 1); left++; }
      };
      ws.onclose = () => { $('sw-mode').innerHTML = '&#9679; reconnecting'; setTimeout(connect, 3000); };
    }
    connect();
    setInterval(() => { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ name: me.id, size: me.size, wallet: me.wallet || undefined })); }, 5000);
  }
  cv.addEventListener('pointermove', e => { const r = cv.getBoundingClientRect(); const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height; hov = null; let best = .04; for (const m of M) { const d = Math.hypot(m.x - px, (m.y - py) * (r.height / r.width)); if (d < best) { best = d; hov = m; } } });
  function draw() {
    const W = cv.width, H = cv.height, d = dpr(); cx.fillStyle = '#000'; cx.fillRect(0, 0, W, H);
    cx.strokeStyle = '#0e1218'; for (let x = 0; x < W; x += 80 * d) { cx.beginPath(); cx.moveTo(x, 0); cx.lineTo(x, H); cx.stroke(); } for (let y = 0; y < H; y += 80 * d) { cx.beginPath(); cx.moveTo(0, y); cx.lineTo(W, y); cx.stroke(); }
    let big = M[0];
    for (const m of M) {
      m.a += Math.sin(t * .3 + m.ph) * .01; m.x += Math.cos(m.a) * .00035 * m.size; m.y += Math.sin(m.a) * .0006 * m.size; if (m.x < .05 || m.x > .95) m.a = Math.PI - m.a; if (m.y < .08 || m.y > .92) m.a = -m.a;
      if (m.you) { m.size = 1.2 + POSE.feed * 0.3; }
      const S = 26 * d * m.size, ct = Math.cos(m.a), st = Math.sin(m.a), sq = 1 + .10 * Math.sin(t * 2.4 + m.ph); if (m.size > big.size) big = m;
      const col = m.you ? '#f0bc5f' : (m === hov ? '#7deaff' : '#e9dcb8');
      for (let j = 0; j < 420; j++) { const ax = SH[j * 3] * (1 + .05 * Math.sin(t * 2.4 + m.ph - SH[j * 3] * 3)), ay = SH[j * 3 + 1] * sq, az = SH[j * 3 + 2]; cx.globalAlpha = .35 + (az + .3) * .9; cx.fillStyle = col; cx.fillRect(m.x * W + (ax * ct - ay * st) * S, m.y * H + (ax * st + ay * ct) * S, 1.2 * d, 1.2 * d); }
      cx.globalAlpha = 1; if (m.you || m === hov) { cx.fillStyle = m.you ? '#f0bc5f' : '#7deaff'; cx.font = (10 * d) + 'px IBM Plex Mono, monospace'; cx.fillText(m.label || m.id, m.x * W - 12 * d, m.y * H - S * .55); }
    }
    $('sw-n').textContent = M.length; $('sw-neurons').textContent = (M.length * 3013).toLocaleString('en-US'); $('sw-left').textContent = left; $('sw-big').textContent = big ? (big.label || big.id) : '—';
    $('sw-hover').innerHTML = hov ? ((hov.label || hov.id) + '<br>' + Math.round((Date.now() - hov.born) / 1000) + 's alive') : '&nbsp;<br>&nbsp;';
    t += .016; requestAnimationFrame(draw);
  }
  draw();
  // wallet (EVM, Robinhood Chain 4663)
  $('wallet').addEventListener('click', async () => {
    if (!window.ethereum) { $('w-addr').textContent = 'no wallet found'; return; }
    try {
      const [addr] = await ethereum.request({ method: 'eth_requestAccounts' });
      try { await ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x1237' }] }); }
      catch (e) { if (e.code === 4902) await ethereum.request({ method: 'wallet_addEthereumChain', params: [{ chainId: '0x1237', chainName: 'Robinhood Chain', nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, rpcUrls: ['https://rpc.mainnet.chain.robinhood.com'], blockExplorerUrls: ['https://robinhoodchain.blockscout.com'] }] }); }
      me.id = addr.slice(0, 6) + '…' + addr.slice(-4); me.wallet = addr; $('w-addr').textContent = me.id; $('p-wallet').className = 'pip2 on';
      if (CONFIG.token && CONFIG.token.address) { const data = '0x70a08231' + addr.slice(2).padStart(64, '0'); const bal = await Feeder.rpc('eth_call', [{ to: CONFIG.token.address, data }, 'latest']); const b = Number(BigInt(bal) / 10n ** 12n) / 1e6; me.size = 1.2 + Math.log10(1 + b) * 0.25; $('w-addr').textContent = me.id + ' · ' + b.toLocaleString('en-US') + ' MAGGOTS'; } if (window.gutShare) gutShare(addr);
      else $('w-addr').textContent = me.id + ' · balance shows after launch';
    } catch (e) { $('w-addr').textContent = 'declined'; }
  });
})();

/* ---------- boot ---------- */
(async () => {
  try {
    await Brain.load(CONFIG.brainUrl);
    brainReady = true; $('r-off').hidden = true; $('t-live').className = 'tlive on'; $('t-live').innerHTML = '&#9679; LIVE';
    push('connectome loaded. 3,013 neurons, 111,243 connections. Winding et al. 2023.', 'ok');
    push('resting. no spontaneous drive beyond a faint hum. the market is its world.', '');
    setInterval(() => frame(performance.now()), 20); setInterval(renderTick, 100);
    const feeds = CONFIG.feeds.slice(); if (CONFIG.token && CONFIG.token.id) feeds.push({ name: 'MAGGOTS', id: CONFIG.token.id, tokenIs0: CONFIG.token.tokenIs0, decimals: CONFIG.token.decimals || 18 });
    Feeder.on(onTrade); Feeder.start({ pools: feeds, intervalMs: 4000 });
    push('nose on the fly. reading FLYBRAIN swaps from the public RPC, backfilling a few minutes.', '');
  } catch (e) { $('r-off').innerHTML = 'COULD NOT LOAD THE CONNECTOME<br><span class="tdim">' + String(e).slice(0, 80) + '</span>'; }
})();
