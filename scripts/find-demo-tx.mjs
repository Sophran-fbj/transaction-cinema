// Scan recent mainnet blocks for plain ETH transfers (empty calldata + value).
// Usage: node scripts/find-demo-tx.mjs [minEth=1] [maxEth=100]
const RPCS = [
  'https://ethereum-rpc.publicnode.com',
  'https://eth.llamarpc.com',
  'https://rpc.ankr.com/eth',
]

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

const [minEth = '1', maxEth = '100'] = process.argv.slice(2)
const min = BigInt(Math.round(Number(minEth) * 1e18))
const max = BigInt(Math.round(Number(maxEth) * 1e18))

const latest = await rpc('eth_getBlockByNumber', ['latest', false])
for (let n = Number(latest.number) - 1; n > Number(latest.number) - 40; n--) {
  const block = await rpc('eth_getBlockByNumber', ['0x' + n.toString(16), true])
  if (!block) continue
  const hits = (block.transactions || []).filter(
    (tx) => tx.input === '0x' && tx.to && BigInt(tx.value) >= min && BigInt(tx.value) <= max,
  )
  if (hits.length > 0) {
    console.log(`block ${n}:`)
    for (const tx of hits.slice(0, 8)) {
      console.log(`  ${tx.hash}  ${Number(BigInt(tx.value)) / 1e18} ETH  ${tx.from} -> ${tx.to}`)
    }
    break
  }
}
