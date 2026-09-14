// Find a real single-pool Uniswap V3 swap: recent blocks, receipts, keep txs
// with exactly one V3 Swap event and exactly two ERC20 Transfers forming
// user→pool→user (caller-relayed legs allowed only for WETH, ETH bridging).
// Usage: node scripts/find-v3-swap.mjs [blocks=3]
import { keccak256, toEventSignature } from 'viem'

const RPCS = ['https://ethereum-rpc.publicnode.com']

const WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
const V3_SWAP_TOPIC = keccak256(
  toEventSignature('Swap(address,address,int256,int256,uint160,uint128,int24)'),
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

// two's-complement signed int from a 32-byte hex data word
const signed = (hex) => {
  const v = BigInt(hex)
  return v >= 2n ** 255n ? v - 2n ** 256n : v
}

const span = Number(process.argv[2] ?? '3')
const latest = Number((await rpc('eth_getBlockByNumber', ['latest', false])).number)

let found = 0
outer: for (let n = latest - 1; n > latest - span && found < 8; n--) {
  const block = await rpc('eth_getBlockByNumber', ['0x' + n.toString(16), true])
  if (!block) continue

  for (const tx of block.transactions || []) {
    const receipt = await rpc('eth_getTransactionReceipt', [tx.hash])
    if (!receipt || receipt.status !== '0x1') continue

    const swaps = receipt.logs.filter((l) => l.topics[0] === V3_SWAP_TOPIC)
    if (swaps.length !== 1) continue
    const pool = swaps[0].address.toLowerCase()

    const transfers = receipt.logs.filter(
      // ERC20 Transfer has 3 topics (sig + from + to); 4 topics would be ERC721
      (l) => l.topics[0] === TRANSFER_TOPIC && l.topics.length === 3,
    )
    if (transfers.length !== 2) continue

    const user = tx.from.toLowerCase()
    const caller = tx.to ? tx.to.toLowerCase() : null
    const addr = (topic) => '0x' + topic.slice(26).toLowerCase()

    const inT = transfers.find(
      (l) => addr(l.topics[2]) === pool && [user, caller].includes(addr(l.topics[1])),
    )
    const outT = transfers.find(
      (l) => addr(l.topics[1]) === pool && [user, caller].includes(addr(l.topics[2])),
    )
    if (!inT || !outT) continue

    const relayed = addr(inT.topics[1]) !== user || addr(outT.topics[2]) !== user
    if (relayed && inT.address.toLowerCase() !== WETH && outT.address.toLowerCase() !== WETH) continue

    const data = swaps[0].data
    const amount0 = signed('0x' + data.slice(2, 66))
    const amount1 = signed('0x' + data.slice(66, 130))
    // layout: amount0, amount1, sqrtPriceX96, liquidity, tick
    const tickRaw = BigInt('0x' + data.slice(258, 322))
    const tick = tickRaw >= 2n ** 23n ? Number(tickRaw - 2n ** 24n) : Number(tickRaw)
    console.log(
      `${tx.hash}  pool ${pool}  amount0=${amount0}  amount1=${amount1}  tick=${tick}  in=${BigInt(inT.data)} (${inT.address})  out=${BigInt(outT.data)} (${outT.address})  block ${n}`,
    )
    found++
    if (found >= 8) break outer
  }
}
if (found === 0) console.log('none found — widen the span')
