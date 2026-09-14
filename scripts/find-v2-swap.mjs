// Brute-force scan: pull receipts for every tx in recent blocks and keep the
// ones whose logs contain a V2-pair Swap event, then apply the app's own
// detection shape (one Swap+Sync from one pair, exactly two ERC20 Transfers
// X→pair and pair→Y, X/Y ∈ {tx sender, tx.to}, caller-relayed legs WETH-only).
// Works for any V2 fork (Uniswap, SushiSwap, …) — no getLogs needed.
// Usage: node scripts/find-v2-swap.mjs [blocks=4]
import { keccak256, toEventSignature } from 'viem'

const RPCS = ['https://ethereum-rpc.publicnode.com', 'https://rpc.ankr.com/eth']

const WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
const SWAP_TOPIC = keccak256(
  toEventSignature('Swap(address,uint256,uint256,uint256,uint256,address)'),
)
const TRANSFER_TOPIC = keccak256(toEventSignature('Transfer(address,address,uint256)'))

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

const span = Number(process.argv[2] ?? '4')
const latest = Number((await rpc('eth_getBlockByNumber', ['latest', false])).number)

let found = 0
outer: for (let n = latest - 1; n > latest - span && found < 8; n--) {
  const block = await rpc('eth_getBlockByNumber', ['0x' + n.toString(16), true])
  if (!block) continue

  for (const tx of block.transactions || []) {
    const receipt = await rpc('eth_getTransactionReceipt', [tx.hash])
    if (!receipt || receipt.status !== '0x1') continue

    const swaps = receipt.logs.filter((l) => l.topics[0] === SWAP_TOPIC)
    if (swaps.length !== 1) continue
    const pair = swaps[0].address.toLowerCase()

    const transfers = receipt.logs.filter(
      (l) => l.topics[0] === TRANSFER_TOPIC && l.topics.length === 4,
    )
    if (transfers.length !== 2) continue

    const user = tx.from.toLowerCase()
    const caller = tx.to ? tx.to.toLowerCase() : null
    const addr = (topic) => '0x' + topic.slice(26).toLowerCase()

    const inT = transfers.find(
      (l) => addr(l.topics[2]) === pair && [user, caller].includes(addr(l.topics[1])),
    )
    const outT = transfers.find(
      (l) => addr(l.topics[1]) === pair && [user, caller].includes(addr(l.topics[2])),
    )
    if (!inT || !outT) continue

    const relayed = addr(inT.topics[1]) !== user || addr(outT.topics[2]) !== user
    if (relayed && inT.address.toLowerCase() !== WETH && outT.address.toLowerCase() !== WETH) continue

    const ethIn = BigInt(tx.value) > 0n
    const ethOut = addr(outT.topics[2]) !== user
    console.log(
      `${tx.hash}  pair ${pair}  ${ethIn ? 'ETH' : 'tok'}→${ethOut ? 'ETH' : 'tok'}  in=${BigInt(inT.data)} (${inT.address})  out=${BigInt(outT.data)} (${outT.address})  block ${n}`,
    )
    found++
    if (found >= 8) break outer
  }
}
if (found === 0) console.log('none found — widen the span')
