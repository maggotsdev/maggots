# A 3,013-neuron connectome-constrained model of a *Drosophila* larva that feeds on a token

**MAGGOTS working paper · v0.1 draft · September 2026**

## Abstract

We run the complete central nervous system connectome of a first-instar *Drosophila melanogaster* larva (Winding et al., *Science* 2023) as a leaky integrate-and-fire network in a web browser, with no GPU and no server, and couple its sensory neurons to a live on-chain market. Swap events from a Uniswap v4 pool on Robinhood Chain are read directly from the public RPC in the client. Sells raise an odor at a point on a two-dimensional plate; buys flash it with light. The larva samples odor and light on its left and right, driving the paper's own labelled olfactory (ORN, n = 42) and photoreceptor (Rh5/Rh6, n = 29) neurons. Motion is read out of descending neurons (dVNC, n = 182); feeding is read out of descending neurons to the subesophageal zone (dSEZ, n = 184). Mushroom body output synapses (KC→MBON, n = 2,988) undergo dopamine-gated depression only. Nothing is trained. The model has reflexes, not a strategy. We state every simplification.

## 1. Why a maggot

The larval connectome was the first complete brain of an insect, published in March 2023. Before it, complete connectomes existed for three animals of a few hundred neurons each. The adult fly connectomes (FlyWire, 2024; male CNS, 2026) followed. Recent projects run the adult brain on a GPU and couple it to a browser or a token. We run the original, smaller brain, on the visitor's own hardware. Fifty-five times fewer neurons; zero GPUs.

## 2. Data

We use the processed release of the paper's tables from the `neurodata/bilateral-connectome` repository: 3,013 brain neurons, 111,243 directed connections, 353,859 counted synapses. The paper's headline figures are 3,016 neurons and 548,000 synapses; the public processed table is the brain-only, cleaned subset and we report what we load. Node annotations used: hemisphere (L/R), sensory modality (ORN, photoRh5, photoRh6, thermo, AN, MN, vtd), and class (KC, MBON, MBIN, dVNC, dSEZ, motor). No transmitter predictions are present in the table.

## 3. Model

Each neuron is a leaky integrator: rest −52 mV, threshold −45 mV, reset −52 mV, membrane time constant 20 ms, refractory 3 ms, step 1 ms. A presynaptic spike adds `w = synapses × 0.22 mV` to the postsynaptic potential, with the summed incoming weight per neuron capped at 36 mV (divisive normalisation). Because signs are absent from the table, every connection is excitatory; stability is provided by spike-frequency adaptation (+3.2 mV per spike, τ = 180 ms) and a global feedback inhibition proportional to the fraction of the population that spiked in the previous step. A runaway state in which more than 45% of neurons fire in one step is counted as a blackout and the state is reset. The network has no spontaneous drive beyond 0.9 mV of per-step noise; with nothing to sense it is nearly silent.

The simulation runs at about 0.2 machine-ms per brain-ms on a 2024 laptop, i.e. about five times faster than real time, in single-threaded JavaScript.

## 4. Senses and the public map

| Market event | Sense | Neurons |
|---|---|---|
| Sell of a watched pool | odor rises at that pool's point on the plate | ORN L/R, 42 |
| Buy of a watched pool | light flashes at that point | Rh5/Rh6 L/R, 29 |
| Large sell | odor + dopamine | ORN + MBIN (reward lot, 15) |
| Own-token buy | taste + dopamine | AN 175 + MBIN |
| Own-token sell | touch | MN + vtd, 179 |
| Own-token large sell | touch + punishment | + MBIN (punishment lot, 13) |
| A visitor click | touch | MN + vtd |

The map is fixed and public. No language model or agent is anywhere in the loop.

## 5. Navigation and feeding

The larva has a position and heading on a plate. Each 20 ms it samples odor and light 3.5% of the plate width to the left and right of its head and drives the corresponding hemisphere's ORN and photoreceptor sets in proportion. Because the crawl rhythm of a real larva is generated in the ventral nerve cord, which the brain table does not include, forward crawl is a constant. The brain steers: heading changes with the normalised difference in firing between the left and right hemispheres over the last 120 ms (the wiring is largely ipsilateral, so the side that smells more fires more), plus the difference between the right- and left-turn dVNC lots. The forward and backward dVNC lots scale the pace. When the larva is within a fixed radius of a pool's point and that pool's odor exceeds a threshold, the gustatory set (AN) is driven; if the dSEZ fraction exceeds 2% while on the corpse, a meal is counted and the odor is reduced. Meals are rate-limited to one per 1.5 s.

## 6. Learning

Kenyon cell → MBON synapses are split by MBON index parity into an approach lobe and an avoid lobe. When a reward-lot MBIN spikes, active KC inputs to approach-lobe MBONs are depressed by 1.5%; punishment-lot MBINs do the same for the avoid lobe. Weights relax toward their original value with a slow time constant and never fall below 25% of it. This is a caricature of dopamine-gated depression at the larval mushroom body; the site of plasticity and the direction are the paper's, the lobe split is ours.

## 7. Feeder

Uniswap v4 emits `Swap(bytes32 indexed id, address indexed sender, int128 amount0, int128 amount1, …)` from the PoolManager (`0x8366…0951` on Robinhood Chain). The client polls `eth_getLogs` every 4 s for the watched pool ids, decodes the sign-extended 32-byte amounts, and classifies a swap as a buy if the swapper's delta in the meme token is positive. The public RPC allows cross-origin requests, so no server, indexer or key is involved. A few minutes are backfilled on load.

## 8. What is not real

- Every connection excites; GABA and glutamate inhibition are replaced by global inhibition and adaptation.
- The scatter layout is by signal flow and hemisphere, not soma position.
- The five crawl behaviours are a fixed hash split of the 182 dVNC neurons; only feeding (dSEZ) and the senses use the paper's labels.
- There is no body model; the drawn larva is a point cloud posed by descending rates.
- The plate, the odor field and the choice of corpses are a person's design.
- The lobe split for plasticity is ours.

## 9. Tokenomics

*To be written once the pairing question is settled.* Candidate designs: (a) pair MAGGOTS against FLYBRAIN so every MAGGOTS buy is FLYBRAIN demand; (b) creator fees in ETH buy FLYBRAIN into a public "gut" wallet, triggered by feeding-neuron activity, with a slice sold on FLYBRAIN strength to buy MAGGOTS back.

## 10. Data and code availability

Connectome: Winding et al. 2023, doi:10.1126/science.add9330, tables via github.com/neurodata/bilateral-connectome. Model, feeder and page: to be published under MIT at launch.

## References

Winding M, Pedigo BD, Barnes CL, Patsolic HG, et al. The connectome of an insect brain. *Science* 379, eadd9330 (2023).
Shiu PK, et al. A *Drosophila* computational brain model reveals sensorimotor processing. *Nature* (2024).
Dorkenwald S, et al.; Schlegel P, et al. FlyWire. *Nature* (2024).
