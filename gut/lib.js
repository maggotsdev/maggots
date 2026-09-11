/* The gut · shared plumbing. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import { createPublicClient, createWalletClient, http, parseAbi, encodeAbiParameters, encodeFunctionData, getAddress, formatUnits, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

export const here = path.dirname(fileURLToPath(import.meta.url));
export const CFG = JSON.parse(fs.readFileSync(path.join(here, 'config.json'), 'utf8'));
export const chain = { id: CFG.chainId, name: 'Robinhood Chain', nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [CFG.rpc] } } };
export const pub = createPublicClient({ chain, transport: http(CFG.rpc, { retryCount: 6, retryDelay: 1500 }) });

export function wallet() {
  const pk = process.env.GUT_PRIVATE_KEY;
  if (!pk) throw new Error('GUT_PRIVATE_KEY missing. Copy .env.example to .env and put the gut wallet key there.');
  const account = privateKeyToAccount(pk.startsWith('0x') ? pk : '0x' + pk);
  return { account, client: createWalletClient({ account, chain, transport: http(CFG.rpc) }) };
}

export const ERC20 = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function totalSupply() view returns (uint256)',
  'function allowance(address,address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
  'function transfer(address,uint256) returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
]);
export const PERMIT2 = parseAbi([
  'function approve(address token, address spender, uint160 amount, uint48 expiration)',
  'function allowance(address user, address token, address spender) view returns (uint160 amount, uint48 expiration, uint48 nonce)',
]);
export const UR = parseAbi(['function execute(bytes commands, bytes[] inputs, uint256 deadline) payable']);
export const QUOTER = [{ type: 'function', name: 'quoteExactInputSingle', stateMutability: 'nonpayable', inputs: [{ name: 'params', type: 'tuple', components: [
  { name: 'poolKey', type: 'tuple', components: [{ name: 'currency0', type: 'address' }, { name: 'currency1', type: 'address' }, { name: 'fee', type: 'uint24' }, { name: 'tickSpacing', type: 'int24' }, { name: 'hooks', type: 'address' }] },
  { name: 'zeroForOne', type: 'bool' }, { name: 'exactAmount', type: 'uint128' }, { name: 'hookData', type: 'bytes' }] }],
  outputs: [{ name: 'amountOut', type: 'uint256' }, { name: 'gasEstimate', type: 'uint256' }] }];

export const fmt = (v, d = 18, p = 2) => Number(formatUnits(v, d)).toLocaleString('en-US', { maximumFractionDigits: p });
export const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function balance(token, who) { return pub.readContract({ address: getAddress(token), abi: ERC20, functionName: 'balanceOf', args: [getAddress(who)] }); }

/* ---------- Uniswap v4 swap through the Universal Router ---------- */
// Commands / actions from v4-periphery. V4_SWAP = 0x10; SWAP_EXACT_IN_SINGLE = 0x06; SETTLE_ALL = 0x0c; TAKE_ALL = 0x0f.
export function poolKey(a, b, fee, tickSpacing, hooks) {
  const [c0, c1] = [getAddress(a), getAddress(b)].sort((x, y) => (x.toLowerCase() < y.toLowerCase() ? -1 : 1));
  return { currency0: c0, currency1: c1, fee, tickSpacing, hooks: getAddress(hooks) };
}
export function encodeV4ExactInSingle(key, tokenIn, amountIn, minOut) {
  const zeroForOne = getAddress(tokenIn) === key.currency0;
  const tokenOut = zeroForOne ? key.currency1 : key.currency0;
  const actions = '0x060c0f';
  const swap = encodeAbiParameters(
    [{ type: 'tuple', components: [
      { type: 'tuple', name: 'poolKey', components: [{ type: 'address', name: 'currency0' }, { type: 'address', name: 'currency1' }, { type: 'uint24', name: 'fee' }, { type: 'int24', name: 'tickSpacing' }, { type: 'address', name: 'hooks' }] },
      { type: 'bool', name: 'zeroForOne' }, { type: 'uint128', name: 'amountIn' }, { type: 'uint128', name: 'amountOutMinimum' }, { type: 'bytes', name: 'hookData' }] }],
    [{ poolKey: key, zeroForOne, amountIn, amountOutMinimum: minOut, hookData: '0x' }]);
  const settle = encodeAbiParameters([{ type: 'address' }, { type: 'uint256' }], [getAddress(tokenIn), amountIn]);
  const take = encodeAbiParameters([{ type: 'address' }, { type: 'uint256' }], [tokenOut, minOut]);
  const input = encodeAbiParameters([{ type: 'bytes' }, { type: 'bytes[]' }], [actions, [swap, settle, take]]);
  return { commands: '0x10', inputs: [input], tokenOut };
}
export async function quote(key, tokenIn, amountIn) {
  const zeroForOne = getAddress(tokenIn) === key.currency0;
  const r = await pub.simulateContract({ address: getAddress(CFG.uniswap.quoter), abi: QUOTER, functionName: 'quoteExactInputSingle', args: [{ poolKey: key, zeroForOne, exactAmount: amountIn, hookData: '0x' }] }).catch(e => { throw new Error('quote failed: ' + (e.shortMessage || e.message)); });
  return r.result[0];
}
export async function ensureApprovals(w, token, amount) {
  const t = getAddress(token), p2 = getAddress(CFG.uniswap.permit2), ur = getAddress(CFG.uniswap.universalRouter);
  const al = await pub.readContract({ address: t, abi: ERC20, functionName: 'allowance', args: [w.account.address, p2] });
  if (al < amount) { const h = await w.client.writeContract({ address: t, abi: ERC20, functionName: 'approve', args: [p2, 2n ** 256n - 1n] }); await pub.waitForTransactionReceipt({ hash: h }); console.log('approved token to Permit2', h); }
  const [amt, exp] = await pub.readContract({ address: p2, abi: PERMIT2, functionName: 'allowance', args: [w.account.address, t, ur] });
  if (amt < amount || exp < Math.floor(Date.now() / 1000) + 3600) { const h = await w.client.writeContract({ address: p2, abi: PERMIT2, functionName: 'approve', args: [t, ur, 2n ** 160n - 1n, Math.floor(Date.now() / 1000) + 30 * 86400] }); await pub.waitForTransactionReceipt({ hash: h }); console.log('Permit2 allowance to router', h); }
}
export async function swap(w, key, tokenIn, amountIn, slippageBps) {
  const q = await quote(key, tokenIn, amountIn);
  const minOut = q - (q * BigInt(slippageBps)) / 10000n;
  await ensureApprovals(w, tokenIn, amountIn);
  const { commands, inputs, tokenOut } = encodeV4ExactInSingle(key, tokenIn, amountIn, minOut);
  const hash = await w.client.writeContract({ address: getAddress(CFG.uniswap.universalRouter), abi: UR, functionName: 'execute', args: [commands, inputs, BigInt(Math.floor(Date.now() / 1000) + 600)] });
  const rc = await pub.waitForTransactionReceipt({ hash });
  if (rc.status !== 'success') throw new Error('swap reverted ' + hash);
  return { hash, quoted: q, minOut, tokenOut };
}

/* ---------- ledger ---------- */
export function ledgerPath() { return path.resolve(here, CFG.ledger); }
export function readLedger() { try { return JSON.parse(fs.readFileSync(ledgerPath(), 'utf8')); } catch { return { epochs: [], buys: [], drops: [], totals: { usdgClaimed: '0', flyBought: '0', flyDropped: '0', maggotsBurned: '0', recipients: 0 } }; } }
export function writeLedger(l) { fs.writeFileSync(ledgerPath(), JSON.stringify(l, null, 1)); }
