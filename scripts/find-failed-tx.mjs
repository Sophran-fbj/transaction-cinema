// Find reverted transactions with decodable intent: scan recent full blocks,
// pull receipts for calldata that looks like transfer/approve (or plain value
// moves), keep status === '0x0'.
// Usage: node scripts/find-failed-tx.mjs [blocks=6]
const RPCS = [
  'https://ethereum-rpc.publicnode.com',
  'https://eth.llamarpc.com',
  'https://rpc.ankr.com/eth',
]

const INTENT_SELECTORS = ['0xa9059cbb', '0x095ea7b3', '0x23b872dd']

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

const span = Number(process.argv[2] ?? '6')
const latest = Number((await rpc('eth_getBlockByNumber', ['latest', false])).number)

let found = 0
outer: for (let n = latest - 1; n > latest - span && found < 5; n--) {
  const block = await rpc('eth_getBlockByNumber', ['0x' + n.toString(16), true])
  if (!block) continue
  for (const tx of block.transactions || []) {
    const isIntentCall = INTENT_SELECTORS.some((s) => tx.input?.startsWith(s))
    const isNative = tx.input === '0x' && tx.to && BigInt(tx.value) > 0n
    if (!isIntentCall && !isNative) continue

    const receipt = await rpc('eth_getTransactionReceipt', [tx.hash])
    if (!receipt || receipt.status !== '0x0') continue

    const kind = isNative ? 'native' : tx.input.slice(0, 10)
    const valueHex = '0x' + tx.input.slice(74, 138).padStart(64, '0')
    console.log(
      `${tx.hash}  reverted ${kind}  to=${tx.to}  arg≈${isNative ? Number(BigInt(tx.value)) / 1e18 + ' ETH' : BigInt(valueHex)}  gasUsed=${BigInt(receipt.gasUsed)}  block ${n}`,
    )
    found++
    if (found >= 5) break outer
  }
}
if (found === 0) console.log('none found — widen the block span')
