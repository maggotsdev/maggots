/* ---------------------------------------------------------------------------
   MAGGOTS · the larval brain.

   Winding et al. 2023 (Science): the complete connectome of a first-instar
   Drosophila larva. 3,013 neurons and 111,243 connections in the table we
   load (brain.json), built from the public neurodata release of the paper.

   Model: leaky integrate-and-fire, 1 ms step. Each connection's strength is
   the synapse count from the microscope. This table carries no transmitter
   signs, so every connection excites and a global feedback inhibition holds
   the population in check. That is stated on the page. Nothing is trained.
   Only the mushroom-body synapses (KC -> MBON) change, under a dopamine
   signal, by depression only - the rule a larva actually uses.
--------------------------------------------------------------------------- */
window.Brain = (function () {
  const P = {
    dt: 1,            // ms
    tau: 20,          // ms membrane time constant
    vRest: -52, vTh: -45, vReset: -52,
    refr: 3,          // ms
    gain: 0.22,       // mV per synapse per presynaptic spike, before normalisation
    inCap: 36,        // max summed incoming weight per neuron, mV (divisive normalisation)
    aInc: 3.2, aTau: 180, // spike-frequency adaptation: mV added per spike, decay ms
    vFloor: -70,
    noise: 0.9,       // mV std per step, keeps a faint hum at rest
    inhib: 0.9,       // global feedback inhibition, mV per % of population spiking
    drive: 8.5,       // mV per step into a stimulated sensory neuron
    blackoutFrac: 0.45, // if this fraction fires in one step the larva blacks out
    mbDepress: 0.985, mbRelax: 0.00002, mbFloor: 0.25,
  };

  let D = null;                // data
  let n = 0, V, A, lastSpike, spk, rate, groupOf, hemi, name, color, lx, ly;
  let ptr, idx, w, w0;         // CSR by source
  let stim;                    // per-neuron drive, decays
  let sets = {};               // named neuron sets
  let t = 0, steps = 0, blackouts = 0, spikesTotal = 0;
  let popRate = 0;             // EMA fraction spiking per step
  let mb = { depressed: 0, rewards: 0, punishments: 0, edges: [] };
  const groupRate = {};        // EMA spikes per second per group
  const groupN = {};
  let recentSpikes = [];       // ring of per-step counts for sparkline

  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  async function load(url) {
    D = (url && typeof url === 'object') ? url : await (await fetch(url)).json();   // a URL in the browser, a parsed object in Node
    n = D.nodes.length;
    V = new Float32Array(n).fill(P.vRest); A = new Float32Array(n);
    lastSpike = new Float32Array(n).fill(-1e9);
    spk = new Uint8Array(n);
    rate = new Float32Array(n);
    stim = new Float32Array(n);
    groupOf = new Array(n); hemi = new Array(n); name = new Array(n); color = new Array(n);
    lx = new Float32Array(n); ly = new Float32Array(n);
    D.nodes.forEach((r, i) => {
      name[i] = r[0]; groupOf[i] = r[1]; hemi[i] = r[2]; color[i] = r[6];
      // layout: signal flow left->right (inputs to outputs), hemispheres top/bottom, latent jitter
      lx[i] = 0.06 + r[3] * 0.88;
      const jit = Math.tanh(r[4] * 3) * 0.16 + Math.tanh(r[5] * 3) * 0.06;
      ly[i] = (r[2] === 'L' ? 0.30 : 0.70) + jit;
      groupN[r[1]] = (groupN[r[1]] || 0) + 1; groupRate[r[1]] = 0;
    });
    // CSR by source
    const deg = new Int32Array(n);
    for (const e of D.edges) deg[e[0]]++;
    ptr = new Int32Array(n + 1); for (let i = 0; i < n; i++) ptr[i + 1] = ptr[i] + deg[i];
    idx = new Int32Array(D.edges.length); w = new Float32Array(D.edges.length); w0 = new Float32Array(D.edges.length);
    const fill = new Int32Array(n);
    D.edges.forEach(e => { const k = ptr[e[0]] + fill[e[0]]++; idx[k] = e[1]; w[k] = e[2] * P.gain; });
    // divisive normalisation: no neuron may receive more than inCap mV per full sweep of its inputs
    const sumIn = new Float32Array(n); for (let k = 0; k < idx.length; k++) sumIn[idx[k]] += w[k];
    for (let k = 0; k < idx.length; k++) { const c = sumIn[idx[k]]; if (c > P.inCap) w[k] *= P.inCap / c; w0[k] = w[k]; }
    // mushroom body edges KC -> MBON, split into approach (even) / avoid (odd) lobes
    for (let i = 0; i < n; i++) if (groupOf[i] === 'KC') for (let k = ptr[i]; k < ptr[i + 1]; k++) if (groupOf[idx[k]] === 'MBON') mb.edges.push([k, idx[k] % 2]);
    // senses, from the paper's own labels on the 431 sensory neurons:
    //   ORN = olfactory (smell), photoRh5/Rh6 = Bolwig's organ (light), thermo = warmth,
    //   AN = antennal nerve (dorsal organ: taste), MN + vtd = maxillary nerve and body wall (touch)
    sets.smell = []; sets.light = []; sets.warm = []; sets.taste = []; sets.touch = [];
    sets.smellL = []; sets.smellR = []; sets.lightL = []; sets.lightR = [];   // by hemisphere, for navigation
    D.nodes.forEach((r, i) => {
      const m = r[7]; if (!m) return;
      if (m === 'ORN') { sets.smell.push(i); (r[2] === 'L' ? sets.smellL : sets.smellR).push(i); }
      else if (m.startsWith('photo')) { sets.light.push(i); (r[2] === 'L' ? sets.lightL : sets.lightR).push(i); }
      else if (m === 'thermo') sets.warm.push(i);
      else if (m === 'AN') sets.taste.push(i); else sets.touch.push(i);
    });
    sets.reward = []; sets.punish = [];
    for (let i = 0; i < n; i++) if (groupOf[i] === 'MBIN') (i % 2 ? sets.punish : sets.reward).push(i);
    // descending lots for the behaviour bars
    sets.fwd = []; sets.back = []; sets.turnL = []; sets.turnR = []; sets.hunch = []; sets.roll = []; sets.feed = [];
    for (let i = 0; i < n; i++) {
      if (groupOf[i] === 'dSEZ') sets.feed.push(i);
      if (groupOf[i] === 'dVNC') { const h = hash(name[i].replace(/ (left|right)$/, '')) % 5; if (h === 0) sets.fwd.push(i); else if (h === 1) sets.back.push(i); else if (h === 2) (hemi[i] === 'L' ? sets.turnL : sets.turnR).push(i); else if (h === 3) sets.hunch.push(i); else sets.roll.push(i); }
    }
    return D;
  }

  function step(k) {
    const inh = P.inhib, dtTau = P.dt / P.tau;
    for (let s = 0; s < k; s++) {
      t += P.dt; steps++;
      let fired = 0;
      // integrate
      const gInh = popRate * 100 * inh;
      for (let i = 0; i < n; i++) {
        if (t - lastSpike[i] < P.refr) { spk[i] = 0; continue; }
        let v = V[i], a = A[i];
        v += (P.vRest - v) * dtTau + stim[i] + (Math.random() - 0.5) * 2 * P.noise - gInh - a;
        a -= a * (P.dt / P.aTau);
        if (stim[i] > 0) stim[i] *= 0.9;
        if (v < P.vFloor) v = P.vFloor;
        if (v >= P.vTh) { spk[i] = 1; v = P.vReset; lastSpike[i] = t; fired++; rate[i] = rate[i] * 0.9 + 100; a += P.aInc; }
        else { spk[i] = 0; rate[i] *= 0.9; }
        V[i] = v; A[i] = a;
      }
      // blackout: runaway state, reset, count it
      if (fired > n * P.blackoutFrac) { blackouts++; V.fill(P.vReset); A.fill(0); stim.fill(0); popRate = 0; fired = 0; }
      // propagate
      for (let i = 0; i < n; i++) if (spk[i]) for (let e = ptr[i]; e < ptr[i + 1]; e++) V[idx[e]] += w[e];
      spikesTotal += fired;
      popRate = popRate * 0.8 + (fired / n) * 0.2;
      recentSpikes.push(fired); if (recentSpikes.length > 240) recentSpikes.shift();
      // group rates: spikes/sec per group, EMA
      // mushroom body plasticity: dopamine-gated depression, slow relaxation
      let rew = 0, pun = 0;
      for (const i of sets.reward) if (spk[i]) rew++;
      for (const i of sets.punish) if (spk[i]) pun++;
      if (rew || pun) {
        for (const [e, lobe] of mb.edges) {
          const src = srcOf(e);
          if (rate[src] > 20 && ((lobe === 0 && rew) || (lobe === 1 && pun))) { if (w[e] > w0[e] * P.mbFloor) { w[e] *= P.mbDepress; } }
        }
        if (rew) mb.rewards++; if (pun) mb.punishments++;
      }
      if (steps % 50 === 0) { let d = 0; for (const [e] of mb.edges) { w[e] += (w0[e] - w[e]) * P.mbRelax * 50; if (w[e] < w0[e] * 0.999) d++; } mb.depressed = d; }
    }
  }
  // source of edge slot e (binary search on ptr)
  function srcOf(e) { let lo = 0, hi = n; while (lo < hi - 1) { const m = (lo + hi) >> 1; if (ptr[m] <= e) lo = m; else hi = m; } return lo; }

  function stimulate(setName, strength = 1, ms = 60) {
    const S = sets[setName]; if (!S) return;
    const amt = P.drive * strength;
    for (const i of S) stim[i] = Math.min(P.drive * 1.6, Math.max(stim[i], amt * (0.7 + Math.random() * 0.6)));
    // duration is approximated by decay in step(); a longer stimulus is a stronger one
    if (ms > 60) for (const i of S) stim[i] *= 1 + Math.min(1, (ms - 60) / 200);
  }

  function setRate(setName) { const S = sets[setName]; if (!S || !S.length) return 0; let r = 0; for (const i of S) r += rate[i]; return r / S.length; }
  function firingNow(win = 100) { let c = 0; for (let i = 0; i < n; i++) if (t - lastSpike[i] < win) c++; return c; }
  function spikesPerSec() { let s = 0; const m = Math.min(recentSpikes.length, 100); for (let i = recentSpikes.length - m; i < recentSpikes.length; i++) s += recentSpikes[i]; return m ? s * (1000 / m) / P.dt : 0; }
  function meanV() { let s = 0; for (let i = 0; i < n; i++) s += V[i]; return s / n; }
  function hemiFiring(win = 120) { let L = 0, R = 0; for (let i = 0; i < n; i++) if (t - lastSpike[i] < win) { if (hemi[i] === 'L') L++; else R++; } return [L, R]; }
  function groupFiring() { const g = {}; for (const k in groupN) g[k] = 0; for (let i = 0; i < n; i++) if (t - lastSpike[i] < 100) g[groupOf[i]]++; return g; }
  function mbGain() { let s = 0; for (const [e] of mb.edges) s += w[e] / w0[e]; return mb.edges.length ? s / mb.edges.length : 1; }

  return {
    P, load, step, stimulate, setRate, firingNow, spikesPerSec, meanV, groupFiring, hemiFiring, mbGain,
    get n() { return n; }, get t() { return t; }, get steps() { return steps; }, get blackouts() { return blackouts; },
    get spikesTotal() { return spikesTotal; }, get mb() { return mb; }, get sets() { return sets; }, get groupN() { return groupN; },
    get data() { return D; }, lx: () => lx, ly: () => ly, lastSpike: () => lastSpike, rate: () => rate, groupOf: () => groupOf, color: () => color, hemi: () => hemi, name: () => name,
    recent: () => recentSpikes,
  };
})();
