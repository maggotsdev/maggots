"""Pack the Winding et al. 2023 larval connectome into a compact JSON for the browser.
Run: python build_brain.py   ->  site/brain.json
Source: neurodata/bilateral-connectome, data/processed-elife (derived from Winding et al., Science 2023).
"""
import csv, json, math
from pathlib import Path

ROOT = Path(__file__).parent
nodes = list(csv.DictReader(open(ROOT / "data/unmatched_full_nodes.csv", encoding="utf-8")))
edges = [l.strip().split(",") for l in open(ROOT / "data/unmatched_full_edgelist.csv", encoding="utf-8")]

# class groups we care about on the panel
def group(r):
    if r["sensory"] == "True": return "sens"
    if r["motor"] == "True": return "motor"
    if r["dVNCs"] == "True": return "dVNC"      # descending to the nerve cord: the body commands
    if r["dSEZs"] == "True": return "dSEZ"      # descending to the mouth region: feeding
    if r["KCs"] == "True": return "KC"          # mushroom body: learning
    if r["MBONs"] == "True": return "MBON"
    if r["MBINs"] == "True": return "MBIN"      # dopamine/octopamine inputs to the MB: reward
    if r["PNs"] == "True": return "PN"
    if r["LHNs"] == "True": return "LHN"
    if r["CNs"] == "True": return "CN"
    return "other"

idx = {}
N = []
flows = []
for i, r in enumerate(nodes):
    idx[r[""]] = i
    f = float(r["sum_signal_flow"]) if r["sum_signal_flow"] not in ("", "nan") else 0.0
    l0 = float(r["latent_0"]) if r["latent_0"] not in ("", "nan") else 0.0
    l1 = float(r["latent_1"]) if r["latent_1"] not in ("", "nan") else 0.0
    flows.append(f)
    N.append([r["name"][:24], group(r), r["hemisphere"] or "L", round(f, 4), round(l0, 4), round(l1, 4), r["color"] or "#888", r["class2"] if r["sensory"] == "True" else ""])

# normalise flow to 0..1 (input side -> output side)
fmin, fmax = min(flows), max(flows)
for n, f in zip(N, flows):
    n[3] = round((f - fmin) / (fmax - fmin), 4) if fmax > fmin else 0.5

E = []
skipped = 0
for s, d, w in edges:
    if s in idx and d in idx:
        E.append([idx[s], idx[d], int(float(w))])
    else:
        skipped += 1

out = {
    "source": "Winding et al. 2023, Science 379:eadd9330 (larval Drosophila CNS). Tables via neurodata/bilateral-connectome.",
    "n_neurons": len(N), "n_edges": len(E), "n_synapses": sum(e[2] for e in E),
    "fields": {"node": ["name", "group", "hemi", "flow01", "latent0", "latent1", "color", "modality"], "edge": ["src", "dst", "synapses"]},
    "groups": {g: sum(1 for n in N if n[1] == g) for g in sorted(set(n[1] for n in N))},
    "modalities": {m: sum(1 for n in N if n[7] == m) for m in sorted(set(n[7] for n in N if n[7]))},
    "nodes": N, "edges": E,
}
p = ROOT / "site/brain.json"
json.dump(out, open(p, "w"), separators=(",", ":"))
print(f"neurons {len(N)} edges {len(E)} synapses {out['n_synapses']} skipped {skipped} -> {p} ({p.stat().st_size/1e6:.2f} MB)")
print(out["groups"])
