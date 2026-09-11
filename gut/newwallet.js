/* Makes a fresh gut wallet and writes it straight into gut/.env. Prints ONLY the address.
   The private key is never printed. It lives in .env on this machine, which git ignores. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
const here = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(here, '.env');
if (fs.existsSync(envPath) && /GUT_PRIVATE_KEY=0x[0-9a-fA-F]{64}/.test(fs.readFileSync(envPath, 'utf8'))) {
  const addr = fs.readFileSync(envPath, 'utf8').match(/GUT_ADDRESS=(0x[0-9a-fA-F]{40})/);
  console.log('a gut wallet already exists in .env:', addr ? addr[1] : '(address line missing)'); console.log('delete .env first if you really want a new one.'); process.exit(0);
}
const pk = generatePrivateKey(); const a = privateKeyToAccount(pk);
fs.writeFileSync(envPath, `# the gut wallet. never share this file.\nGUT_PRIVATE_KEY=${pk}\nGUT_ADDRESS=${a.address}\n`, { mode: 0o600 });
console.log('gut wallet created. address:', a.address);
console.log('key written to gut/.env (git-ignored). Back that file up somewhere private.');
console.log('send about 0.01 ETH on Robinhood Chain to the address for gas.');
