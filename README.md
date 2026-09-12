# MAGGOTS

The first brain ever mapped was not a fly. It was a maggot.

This repository runs the complete central nervous system connectome of a first-instar *Drosophila* larva (Winding et al., *Science* 2023; 3,013 neurons and 111,243 connections in the public tables) as a leaky integrate-and-fire network in a web browser, with no GPU and no server, and couples its sensory neurons to a live market on Robinhood Chain. Sells of the fly raise a smell on a plate. The larva samples it left and right through the paper's own olfactory neurons, crawls to the corpse, and eats when its feeding neurons fire.

Site: https://maggots.maggots.workers.dev · X: [@maggotsdev](https://x.com/maggotsdev) · Paper: [paper/maggots.md](paper/maggots.md) · Disclosure: [disclosure.md](disclosure.md)

## What is in here

| Path | What |
|---|---|
| `site/` | The page. `brain.js` is the model, `brain.json` the wiring, `feeder.js` reads Uniswap v4 swaps from the public RPC in your browser, `arena.js` is the plate, `app.js` ties it together. Static files; open `index.html` from any web server. |
| `build_brain.py` | Builds `site/brain.json` from the paper's public tables in `data/`. |
| `data/` | The neurodata release of Winding et al. 2023 (node table, edge list). CC-BY. |
| `gut/` | The gut: claims creator fees, buys FLYBRAIN in slices timed by a second copy of the brain, snapshots holders, drops FLYBRAIN to each of them, burns MAGGOTS, writes the ledger the page shows. Node.js, `viem`. |
| `swarm-worker/` | The brood: a Cloudflare Worker with one Durable Object that counts open tabs. |
| `paper/` | The working paper. Methods, the trade-to-sense map, every simplification. |
| `make_logo.py`, `make_pfp.py` | The larva images. |

## Run it

```bash
python build_brain.py          # once, makes site/brain.json
python -m http.server 8080 --directory site
```

Open http://localhost:8080. Press LISTEN to hear the spikes. Click the larva to touch it.

Test the brain alone: `python -m http.server` then open `site/brain-test.html` if you kept it, or run `node gut/brainclock.js 1` to watch the brain clock for one minute from the terminal.

## What is not real

Every connection excites; the public table carries no transmitter signs, so inhibition and adaptation are global. The scatter is a signal-flow layout, not soma positions. The crawl rhythm is a constant because it lives in the nerve cord, which the brain table does not include. The five crawl behaviours are our fixed split of the 182 descending neurons. Feeding and the senses are the paper's labels. Full list in the paper and on the page.

## Data and credits

Winding M, Pedigo BD, Barnes CL, Patsolic HG, et al. The connectome of an insect brain. *Science* 379, eadd9330 (2023). Tables via [neurodata/bilateral-connectome](https://github.com/neurodata/bilateral-connectome). Not affiliated with the authors, Alphabet, Robinhood, or the fly.

MIT. $MAGGOTS is an art experiment, not an investment. Also it is a maggot.
