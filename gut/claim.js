/* Claims creator fees from the Pons V2 fee escrow into the gut wallet.
   The gut wallet must be the token's creator fee recipient (set at launch, or via setCreatorFeeRecipient on the factory, which has a timelock).
   Usage: node claim.js          claims all USDG owed
          node claim.js --check  only prints what is owed */
import { getAddress, parseAbi } from 'viem';
import { CFG, pub, wallet, fmt } from './lib.js';

const ESCROW = parseAbi([
  'function balanceOf(address recipient) view returns (uint256)',
  'function balanceOfToken(address recipient, address token) view returns (uint256)',
  'function claim()',
  'function claimToken(address token)',
]);
export async function owed(who) {
  const esc = getAddress(CFG.pons.feeEscrow);
  const eth = await pub.readContract({ address: esc, abi: ESCROW, functionName: 'balanceOf', args: [who] });
  const usdg = await pub.readContract({ address: esc, abi: ESCROW, functionName: 'balanceOfToken', args: [who, getAddress(CFG.quote.address)] });
  return { eth, usdg };
}
export async function claimAll(w, log = console.log) {
  const esc = getAddress(CFG.pons.feeEscrow); const o = await owed(w.account.address); const out = [];
  if (o.usdg > 0n) { const h = await w.client.writeContract({ address: esc, abi: ESCROW, functionName: 'claimToken', args: [getAddress(CFG.quote.address)] }); await pub.waitForTransactionReceipt({ hash: h }); log(`claimed ${fmt(o.usdg, 6)} USDG ${h}`); out.push({ token: 'USDG', amount: o.usdg.toString(), tx: h }); }
  if (o.eth > 0n) { const h = await w.client.writeContract({ address: esc, abi: ESCROW, functionName: 'claim' }); await pub.waitForTransactionReceipt({ hash: h }); log(`claimed ${fmt(o.eth)} ETH ${h}`); out.push({ token: 'ETH', amount: o.eth.toString(), tx: h }); }
  if (!out.length) log('nothing to claim');
  return out;
}
if (process.argv[1] && process.argv[1].endsWith('claim.js')) {
  const who = process.env.GUT_ADDRESS; const o = await owed(who); console.log(`owed to ${who}: ${fmt(o.usdg, 6)} USDG, ${fmt(o.eth)} ETH`);
  if (!process.argv.includes('--check')) await claimAll(wallet());
}
