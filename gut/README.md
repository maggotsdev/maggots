# The gut

The gut is the wallet and the script that pay MAGGOTS holders in FLYBRAIN.

Each epoch (daily): claim creator fees from Pons → 70% buys FLYBRAIN, in slices timed by the larval brain → 20% buys MAGGOTS and burns it → 10% stays for gas → snapshot every holder → send FLYBRAIN to each one, pro-rata → write the ledger the page shows.

## One-time setup (Windows, PowerShell)

Node is already installed on this machine (v24). In PowerShell:

```powershell
cd D:\ClaudeCode\maggots\gut
npm install
node newwallet.js
```

Copy the `GUT_PRIVATE_KEY=...` line it prints into a new file `D:\ClaudeCode\maggots\gut\.env`, and add `GUT_ADDRESS=` with the address. The `.env` file is ignored by git. Send about 0.01 ETH on Robinhood Chain to the gut address for gas.

**At launch on Pons:** set the gut address as the creator fee recipient. If you launched with your own wallet, call `setCreatorFeeRecipient` on the factory later (it has a timelock) or just send claimed USDG to the gut by hand each day.

After launch, fill in `config.json`: `maggots.address`, `maggots.launchBlock`, `maggots.poolFee` (0 on Pons), `maggots.poolTickSpacing` (200 on Pons), `maggots.hooks` (the Pons meme hook `0xE5e702641Ea86F4ae6cC3cDaeD2B886f976Be044`), and `maggots.poolAddress` if the pool holds tokens at an address to exclude.

## Daily

```powershell
cd D:\ClaudeCode\maggots\gut
node epoch.js
```

First time, test without transactions:

```powershell
node epoch.js --dry
```

Other commands: `node status.js` (what the gut holds and has done), `node claim.js --check` (what Pons owes), `node snapshot.js` (holder list only), `node brainclock.js 5` (watch the brain clock for 5 minutes).

## Safety

- The gut wallet only ever holds one epoch of fees plus gas. If it is ever drained you lose one day, not the token.
- The key lives in `.env` on this machine only. Never paste it anywhere else.
- Every transaction hash is written to `site/gut-ledger.json`, which the page shows. Redeploy the site after each epoch so the ledger is public.
- The buy timing is the brain's. The amount is not. It is fixed by the fees that came in.

## Not yet tested on chain

The swap path (Universal Router, V4 exact-in single) and the Pons hook on the MAGGOTS pool have been encoded from the Uniswap v4 spec and verified contract ABIs but not yet executed. First real epoch should be run with a small amount and watched.
