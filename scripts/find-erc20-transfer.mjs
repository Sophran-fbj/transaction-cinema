// Find a plain ERC20 transfer via eth_getLogs (fast): USDC/USDT Transfer logs
// grouped per tx, keeping txs with exactly one log whose calldata is a direct
// transfer/transferFrom call from an EOA-style sender.
// Usage: node scripts/find-erc20-transfer.mjs [minUnits=20] [blockSpan=120]
const RPCS = [
  'https://ethereum-rpc.publicnode.com',
  'https://eth.llamarpc.com',
  'https://rpc.ankr.com/eth',
]

const TOKENS = {
  USDC: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
  USDT: { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
}
const SELECTORS = ['0xa9059cbb', '0x23b872dd'] // transfer, transferFrom
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

async function rpc(method, params) {
  for (const url of RPCS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      })
      const json = await res.json()
      if (json.result !== undefined && json.result !== null) return json.result
    } catch {
      // try next RPC
    }
  }
  throw new Error(`all RPCs failed for ${method}`)
}

const [minArg = '20', spanArg = '120'] = process.argv.slice(2)
const minUnits = BigInt(Math.round(Number(minArg) * 1e6))
const span = Number(spanArg)

const latest = Number((await rpc('eth_getBlockByNumber', ['latest', false])).number)
const from = '0x' + (latest - span).toString(16)
const to = '0x' + latest.toString(16)

const tokenList = Object.values(TOKENS).map((t) => t.address)
const logs = await rpc('eth_getLogs', [
  { fromBlock: from, toBlock: to, address: tokenList, topics: [TRANSFER_TOPIC] },
])

// group logs by tx — a plain transfer tx has exactly one
const byTx = new Map()
for (const log of logs) {
  if (!byTx.has(log.transactionHash)) byTx.set(log.transactionHash, [])
  byTx.get(log.transactionHash).push(log)
}

let found = 0
for (const [hash, txLogs] of byTx) {
  if (found >= 5) break
  if (txLogs.length !== 1) continue
  const log = txLogs[0]
  const value = BigInt(log.data)
  if (value < minUnits) continue

  const tx = await rpc('eth_getTransactionByHash', [hash])
  if (!tx || !SELECTORS.some((s) => tx.input.startsWith(s))) continue

  const [name] = Object.entries(TOKENS).find(
    ([, t]) => t.address.toLowerCase() === log.address.toLowerCase(),
  )
  console.log(
    `${hash}  ${(Number(value) / 10 ** TOKENS[name].decimals).toLocaleString()} ${name}  ${tx.from} -> 0x${log.topics[2].slice(26)}  block ${Number(log.blockNumber)}`,
  )
  found++
}
if (found === 0) console.log('no candidates — widen blockSpan or lower minUnits')
