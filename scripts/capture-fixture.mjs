// Capture raw JSON-RPC responses for a transaction into a fixture file.
// Fixtures keep dev & tests offline: same raw RPC shapes the live fetch layer
// consumes, so one formatter (rpcToBundle) serves both paths.
//
// Usage: node scripts/capture-fixture.mjs 0x<hash> <kind-dir>
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const RPCS = [
  process.env.RPC_URL,
  'https://eth.drpc.org',
  'https://1rpc.io/eth',
  'https://ethereum-rpc.publicnode.com',
].filter(Boolean)

async function rpc(method, params) {
  for (const url of RPCS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      })
      const json = await res.json()
      if (json.result) return json.result
    } catch {
      // try next RPC
    }
  }
  throw new Error(`all RPCs failed for ${method}`)
}

const [hash, kind = 'misc'] = process.argv.slice(2)
if (!/^0x[0-9a-fA-F]{64}$/.test(hash ?? '')) {
  console.error('usage: node scripts/capture-fixture.mjs 0x<tx-hash> <kind-dir>')
  process.exit(1)
}

const transaction = await rpc('eth_getTransactionByHash', [hash])
if (!transaction) throw new Error('transaction not found')
const receipt = await rpc('eth_getTransactionReceipt', [hash])
if (!receipt) throw new Error('receipt not found (not mined yet?)')
const block = await rpc('eth_getBlockByNumber', [receipt.blockNumber, false])

const fixture = {
  hash,
  chainId: 1,
  transaction, // raw eth_getTransactionByHash result
  receipt, // raw eth_getTransactionReceiptByHash result
  block: { number: block.number, timestamp: block.timestamp },
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const out = resolve(root, 'src/fixtures', kind, `${hash.toLowerCase()}.json`)
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, JSON.stringify(fixture, null, 2) + '\n')
console.log(`wrote ${out}`)
console.log(`  status=${receipt.status} value=${Number(BigInt(transaction.value)) / 1e18} ETH input=${transaction.input === '0x' ? 'empty' : transaction.input.slice(0, 10)}`)
