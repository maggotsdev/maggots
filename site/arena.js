/* ---------------------------------------------------------------------------
   MAGGOTS · the arena.

   A plate. Every corpse (a fly-meta pool we watch) is a spot on it. Sells raise
   the smell of that spot; the smell spreads and fades. Buys flash it with light.
   The larva samples smell and light on its left and right, the way a real larva
   does with its two dorsal organs and two Bolwig's organs, and those samples
   drive the paper's own left and right olfactory and photoreceptor neurons.
   Whatever comes out of the descending neurons moves it. Nothing steers it.
   It eats only when it is on the corpse and its feeding neurons fire.
--------------------------------------------------------------------------- */
window.Arena = (function () {
  const sources = [];               // {name, x, y, odor, light, sells, buys, lastSell}
  const larva = { x: 0.25, y: 0.55, h: 0.2, speed: 0, casting: 0 };
  const trail = [];
  let onCorpse = null, lastMeal = 0, meals = 0, t = 0;
  const eye = { L: new Float32Array(12), R: new Float32Array(12) };

  function addSource(name, x, y) { const s = { name, x, y, odor: 0, light: 0, sells: 0, buys: 0, lastSell: 0, sellVol: 0 }; sources.push(s); return s; }
  function onTrade(ev) {
    const s = sources.find(q => q.name === ev.pool); if (!s) return;
    const size = Math.log10(1 + ev.amount) / 6;                       // 1M tokens -> 1.0
    if (ev.kind === 'sell') { s.odor = Math.min(3, s.odor + 0.35 + size); s.sells++; s.sellVol += ev.amount; s.lastSell = t; }
    else { s.light = Math.min(2, s.light + 0.4 + size * 0.5); s.buys++; }
  }
  function odorAt(x, y) { let o = 0; for (const s of sources) { const d2 = (x - s.x) ** 2 + ((y - s.y) * 0.62) ** 2; o += s.odor * Math.exp(-d2 / 0.22); } return o; }
  function lightAt(x, y) { let o = 0; for (const s of sources) { const d2 = (x - s.x) ** 2 + ((y - s.y) * 0.62) ** 2; o += s.light * Math.exp(-d2 / 0.025); } return o; }

  /* called every brain tick (about 20 ms). Turns the plate into sensory drive and the descending output into motion. */
  function tick(dt, frac) {
    t += dt / 1000;
    for (const s of sources) { s.odor *= Math.exp(-dt / 90000); s.light *= Math.exp(-dt / 4000); }   // smell lasts minutes, light seconds
    // sample left and right of the head
    const hx = larva.x + Math.cos(larva.h) * 0.05, hy = larva.y + Math.sin(larva.h) * 0.08;
    const px = -Math.sin(larva.h) * 0.035, py = Math.cos(larva.h) * 0.055;
    const oL = odorAt(hx + px, hy + py), oR = odorAt(hx - px, hy - py);
    const lL = lightAt(hx + px, hy + py), lR = lightAt(hx - px, hy - py);
    // the paper's own left/right olfactory and photoreceptor neurons
    if (oL > 0.01) Brain.stimulate('smellL', Math.min(1.3, oL * 2.2));
    if (oR > 0.01) Brain.stimulate('smellR', Math.min(1.3, oR * 2.2));
    if (lL > 0.02) Brain.stimulate('lightL', Math.min(1.2, lL));
    if (lR > 0.02) Brain.stimulate('lightR', Math.min(1.2, lR));
    // the eye: 12 pixels a side
    for (let i = 0; i < 12; i++) { const a = larva.h + (i - 5.5) * 0.09; eye.L[i] = Math.min(1, lightAt(hx + Math.cos(a - 0.4) * 0.06, hy + Math.sin(a - 0.4) * 0.09) + 0.02 * odorAt(hx, hy)); eye.R[i] = Math.min(1, lightAt(hx + Math.cos(a + 0.4) * 0.06, hy + Math.sin(a + 0.4) * 0.09) + 0.02 * odorAt(hx, hy)); }
    // on a corpse?
    onCorpse = null; for (const s of sources) { const d2 = (larva.x - s.x) ** 2 + ((larva.y - s.y) * 0.62) ** 2; if (d2 < 0.008 && s.odor > 0.05) onCorpse = s; }
    if (onCorpse) Brain.stimulate('taste', Math.min(1.2, 0.5 + onCorpse.odor * 0.6));
    // motion. The crawl rhythm lives in the nerve cord, which is not in the brain table, so it is a constant here.
    // The brain steers: heading follows the difference in firing between its two halves (the wiring is mostly
    // ipsilateral, so the side that smells more fires more). The descending neurons set the pace and stop it to eat.
    const fwd = frac('fwd'), back = frac('back'), tl = frac('turnL'), tr = frac('turnR'), feed = frac('feed');
    const [hL, hR] = Brain.hemiFiring(120);
    const steer = (hL - hR) / Math.max(20, hL + hR) + (tl - tr) * 2.0;
    const pace = 0.0011 * (1 + fwd * 6 - back * 3);
    larva.speed += (Math.max(0, pace) - larva.speed) * 0.05;
    larva.h += steer * 0.35 + Math.sin(t * 1.7) * 0.012 + (Math.random() - 0.5) * 0.02;   // head casts
    if (onCorpse && feed > 0.02) larva.speed *= 0.2;                     // it stops to eat
    larva.x += Math.cos(larva.h) * larva.speed * (dt / 16); larva.y += Math.sin(larva.h) * larva.speed * 1.6 * (dt / 16);
    if (larva.x < 0.06 || larva.x > 0.94) { larva.h = Math.PI - larva.h; larva.x = Math.min(0.94, Math.max(0.06, larva.x)); }
    if (larva.y < 0.1 || larva.y > 0.9) { larva.h = -larva.h; larva.y = Math.min(0.9, Math.max(0.1, larva.y)); }
    if (larva.speed > 0.0003 && (trail.length === 0 || Math.hypot(trail[trail.length - 1][0] - larva.x, trail[trail.length - 1][1] - larva.y) > 0.01)) { trail.push([larva.x, larva.y]); if (trail.length > 400) trail.shift(); }
    // a meal: on the corpse, feeding neurons firing, not more than one every 1.5 s
    if (onCorpse && feed > 0.02 && t - lastMeal > 1.5) { lastMeal = t; meals++; onCorpse.odor = Math.max(0, onCorpse.odor - 0.08); return { meal: true, corpse: onCorpse.name, feeding: Math.round(feed * 184) }; }
    return null;
  }

  function draw(ctx, cv, LARVA, N, POSE, d) {
    const W = cv.width, H = cv.height;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#0a1a10'; ctx.lineWidth = 1; for (let x = 0; x < W; x += 60 * d) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); } for (let y = 0; y < H; y += 60 * d) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    // smell field, drawn as rings; light as a flash
    for (const s of sources) {
      const cx = s.x * W, cy = s.y * H;
      for (let k = 5; k >= 1; k--) { const r = (0.05 + 0.05 * k) * Math.sqrt(s.odor + 0.05) * W * 0.5; ctx.fillStyle = `rgba(61,255,136,${(0.035 * s.odor / k).toFixed(3)})`; ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 0.62, 0, 0, 6.29); ctx.fill(); }
      if (s.light > 0.03) { ctx.fillStyle = `rgba(220,238,248,${Math.min(0.35, s.light * 0.2).toFixed(3)})`; ctx.beginPath(); ctx.ellipse(cx, cy, 0.09 * W * 0.5 * (1 + s.light), 0.09 * W * 0.31 * (1 + s.light), 0, 0, 6.29); ctx.fill(); }
      ctx.fillStyle = '#1f8f4d'; ctx.font = (10 * d) + 'px IBM Plex Mono, monospace'; ctx.fillText(s.name + '  smell ' + s.odor.toFixed(2) + '  sells ' + s.sells + '  buys ' + s.buys, cx - 40 * d, cy - 16 * d);
      ctx.fillStyle = '#3dff88'; ctx.fillRect(cx - 1.5 * d, cy - 1.5 * d, 3 * d, 3 * d);
    }
    // trail
    ctx.strokeStyle = '#0f3d24'; ctx.lineWidth = d; ctx.beginPath(); trail.forEach(([x, y], i) => i ? ctx.lineTo(x * W, y * H) : ctx.moveTo(x * W, y * H)); ctx.stroke();
    // the larva, head toward heading
    const S = Math.min(W, H) * 0.11, ct = Math.cos(larva.h), st = Math.sin(larva.h), feeding = POSE.feed > 0.3 && onCorpse;
    for (let i = 0; i < N; i += 4) {
      const seg = LARVA[i * 4 + 3]; const sq = 1 + 0.09 * Math.sin(t * 6 - (seg < 90 ? seg * 0.55 : 0));
      let ax = LARVA[i * 4], ay = LARVA[i * 4 + 2] * sq; if (seg === 99) ax += POSE.feed * 0.06 * Math.sin(t * 40);
      const X = larva.x * W + (ax * ct - ay * st) * S, Y = larva.y * H + (ax * st + ay * ct) * S * 1.3;
      ctx.fillStyle = seg >= 98 ? '#6b7a55' : (feeding ? '#c9ffe0' : '#9ad9b3'); ctx.fillRect(X, Y, 1.3 * d, 1.3 * d);
    }
    // the eye: 2 x 12 pixels, top right
    const ex = W - 100 * d, ey = 10 * d, cw = 7 * d;
    ctx.fillStyle = '#155c33'; ctx.font = (9 * d) + 'px IBM Plex Mono, monospace'; ctx.fillText('BOLWIG · 24 px', ex, ey + 8 * d);
    for (let i = 0; i < 12; i++) { const vL = eye.L[i], vR = eye.R[i]; ctx.fillStyle = `rgb(${Math.round(20 + vL * 220)},${Math.round(30 + vL * 220)},${Math.round(25 + vL * 220)})`; ctx.fillRect(ex + i * cw, ey + 12 * d, cw - 1, cw - 1); ctx.fillStyle = `rgb(${Math.round(20 + vR * 220)},${Math.round(30 + vR * 220)},${Math.round(25 + vR * 220)})`; ctx.fillRect(ex + i * cw, ey + 12 * d + cw, cw - 1, cw - 1); }
    // status line
    const st8 = feeding ? 'FEEDING' : POSE.roll > 0.3 ? 'ROLLING' : POSE.hunch > 0.3 ? 'HUNCHING' : larva.speed > 0.0004 ? 'CRAWLING' : 'WAITING';
    ctx.fillStyle = '#155c33'; ctx.font = (10 * d) + 'px IBM Plex Mono, monospace';
    ctx.fillText('smell L ' + odorAt(larva.x - 0.03, larva.y).toFixed(2) + '  R ' + odorAt(larva.x + 0.03, larva.y).toFixed(2) + '  ·  ' + st8 + (onCorpse ? '  on ' + onCorpse.name : ''), 12 * d, H - 34 * d);
  }
  return { addSource, onTrade, tick, draw, larva, sources, get meals() { return meals; }, get onCorpse() { return onCorpse; } };
})();
