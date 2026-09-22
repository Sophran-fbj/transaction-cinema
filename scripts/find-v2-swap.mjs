// Scan V2-pair Swap logs in recent blocks, then apply the app's own detection
// shape to those candidate receipts (one Swap+Sync from one pair, exactly two
// ERC20 Transfers X→pair and pair→Y, X/Y ∈ {tx sender, tx.to}, caller-relayed
// legs WETH-only). This avoids pulling every receipt in every block.
// Works for any V2 fork (Uniswap, SushiSwap, …); factory() is printed so the
// result can be attributed honestly before it becomes a fixture.
// Usage: node scripts/find-v2-swap.mjs [blocks=4]
import { keccak256, toEventSignature } from 'viem'

const RPCS = ['https://eth.drpc.org', 'https://1rpc.io/eth', 'https://ethereum-rpc.publicnode.com']

const WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
const SWAP_TOPIC = keccak256(
  toEventSignature('Swap(address,uint256,uint256,uint256,uint256,address)'),
)
const TRANSFER_TOPIC = keccak256(toEventSignature('Transfer(address,address,uint256)'))
const FACTORY_SELECTOR = '0xc45a0155'

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
const fromBlock = '0x' + Math.max(0, latest - span).toString(16)
const toBlock = '0x' + Math.max(0, latest - 1).toString(16)
const swapLogs = await rpc('eth_getLogs', [{ fromBlock, toBlock, topics: [SWAP_TOPIC] }])
const hashes = [...new Set(swapLogs.map((log) => log.transactionHash))]

let found = 0
for (const hash of hashes) {
  const [tx, receipt] = await Promise.all([
    rpc('eth_getTransactionByHash', [hash]),
    rpc('eth_getTransactionReceipt', [hash]),
  ])
    if (!receipt || receipt.status !== '0x1') continue

    const swaps = receipt.logs.filter((l) => l.topics[0] === SWAP_TOPIC)
    if (swaps.length !== 1) continue
    const pair = swaps[0].address.toLowerCase()

    const transfers = receipt.logs.filter(
      // ERC20 Transfer indexes from/to; value is the 32-byte data word.
      // Four topics would be the ERC721 Transfer shape instead.
      (l) => l.topics[0] === TRANSFER_TOPIC && l.topics.length === 3,
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
    const ethOut = outT.address.toLowerCase() === WETH && addr(outT.topics[2]) !== user
    let factory = 'unknown'
    try {
      const rawFactory = await rpc('eth_call', [{ to: pair, data: FACTORY_SELECTOR }, receipt.blockNumber])
      factory = '0x' + rawFactory.slice(-40)
    } catch {
      // Some forks do not expose factory(); keep the candidate generic.
    }
    console.log(
      `${tx.hash}  pair ${pair}  factory ${factory}  ${ethIn ? 'ETH' : 'tok'}→${ethOut ? 'ETH' : 'tok'}  in=${BigInt(inT.data)} (${inT.address})  out=${BigInt(outT.data)} (${outT.address})  block ${Number(receipt.blockNumber)}`,
    )
    found++
    if (found >= 8) break
}
if (found === 0) console.log('none found — widen the span')
