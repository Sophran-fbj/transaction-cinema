// Find plain ERC20 approvals via eth_getLogs: USDC/USDT Approval logs grouped
// per tx, keeping txs with exactly one log whose calldata is a direct
// approve(address,uint256) call. Tries to surface one of each mode:
// unlimited (max uint256), revoke (zero), limited (anything else).
// Usage: node scripts/find-erc20-approval.mjs [blockSpan=300]
const RPCS = [
  'https://ethereum-rpc.publicnode.com',
  'https://eth.llamarpc.com',
  'https://rpc.ankr.com/eth',
]

const TOKENS = {
  USDC: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
  USDT: { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
}
const APPROVE_SELECTOR = '0x095ea7b3'
const APPROVAL_TOPIC = '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925'
const MAX_UINT256 = 2n ** 256n - 1n

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

const span = Number(process.argv[2] ?? '300')
const latest = Number((await rpc('eth_getBlockByNumber', ['latest', false])).number)

const logs = await rpc('eth_getLogs', [
  {
    fromBlock: '0x' + (latest - span).toString(16),
    toBlock: '0x' + latest.toString(16),
    address: Object.values(TOKENS).map((t) => t.address),
    topics: [APPROVAL_TOPIC],
  },
])

const byTx = new Map()
for (const log of logs) {
  if (!byTx.has(log.transactionHash)) byTx.set(log.transactionHash, [])
  byTx.get(log.transactionHash).push(log)
}

const found = { unlimited: null, revoke: null, limited: null }
outer: for (const [hash, txLogs] of byTx) {
  if (txLogs.length !== 1) continue
  const log = txLogs[0]
  const value = BigInt(log.data)

  const tx = await rpc('eth_getTransactionByHash', [hash])
  if (!tx || !tx.input.startsWith(APPROVE_SELECTOR)) continue

  const [name] = Object.entries(TOKENS).find(
    ([, t]) => t.address.toLowerCase() === log.address.toLowerCase(),
  )
  const mode =
    value === MAX_UINT256 ? 'unlimited' : value === 0n ? 'revoke' : 'limited'
  const spender = '0x' + log.topics[2].slice(26)
  const human = mode === 'unlimited' ? '∞' : mode === 'revoke' ? '0' : (Number(value) / 10 ** TOKENS[name].decimals).toLocaleString()
  console.log(`${mode.padEnd(10)} ${hash}  ${human} ${name}  owner ${tx.from}  spender ${spender}  block ${Number(log.blockNumber)}`)

  if (!found[mode]) found[mode] = hash
  if (found.unlimited && found.revoke && found.limited) break outer
}
