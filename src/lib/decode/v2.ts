import {
  getAddress,
  parseEventLogs,
  type Address,
  type TransactionReceipt,
} from 'viem'
import { parseErc20Transfers } from './events'

const v2PairAbi = [
  {
    type: 'event',
    name: 'Swap',
    inputs: [
      { name: 'sender', type: 'address', indexed: true },
      { name: 'amount0In', type: 'uint256' },
      { name: 'amount1In', type: 'uint256' },
      { name: 'amount0Out', type: 'uint256' },
      { name: 'amount1Out', type: 'uint256' },
      { name: 'to', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'Sync',
    inputs: [
      { name: 'reserve0', type: 'uint112' },
      { name: 'reserve1', type: 'uint112' },
    ],
  },
] as const

const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
export const UNISWAP_V2_FACTORY = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f'

export interface V2SwapSignal {
  pair: Address
  recipient: Address
  tokenIn: { address: Address; amount: bigint }
  tokenOut: { address: Address; amount: bigint }
  reserveIn: bigint
  reserveOut: bigint
  tokenInRelayed: boolean
  tokenOutRelayed: boolean
}

// A deliberately narrow, auditable V2 shape: one pair Swap, its terminal
// Sync, and exactly two ERC20 transfers forming X→pair and pair→Y. Routers
// are accepted without an allowlist, but relayed legs must involve WETH so a
// random multi-contract flow cannot masquerade as a simple swap.
export function detectV2Swap(
  receipt: TransactionReceipt,
  caller: Address | null,
): V2SwapSignal | null {
  const swaps = parseEventLogs({
    abi: v2PairAbi,
    eventName: 'Swap',
    logs: receipt.logs,
    strict: false,
  })
  if (swaps.length !== 1) return null
  const swap = swaps[0]
  const pair = getAddress(swap.address)

  const syncs = parseEventLogs({
    abi: v2PairAbi,
    eventName: 'Sync',
    logs: receipt.logs,
    strict: false,
  }).filter((sync) => getAddress(sync.address) === pair)
  if (syncs.length !== 1) return null

  const { amount0In, amount1In, amount0Out, amount1Out, to } = swap.args
  const { reserve0, reserve1 } = syncs[0].args
  if (
    amount0In === undefined ||
    amount1In === undefined ||
    amount0Out === undefined ||
    amount1Out === undefined ||
    to === undefined ||
    reserve0 === undefined ||
    reserve1 === undefined
  ) {
    return null
  }

  const inputSides = Number(amount0In > 0n) + Number(amount1In > 0n)
  const outputSides = Number(amount0Out > 0n) + Number(amount1Out > 0n)
  if (inputSides !== 1 || outputSides !== 1) return null
  if ((amount0In > 0n && amount0Out > 0n) || (amount1In > 0n && amount1Out > 0n)) {
    return null
  }

  const user = getAddress(receipt.from)
  const transfers = parseErc20Transfers(receipt)
  if (transfers.length !== 2) return null
  const inT = transfers.find((transfer) =>
    (transfer.from === user || transfer.from === caller) && transfer.to === pair,
  )
  const outT = transfers.find((transfer) =>
    transfer.from === pair && (transfer.to === user || transfer.to === caller),
  )
  if (!inT || !outT) return null

  const relayed = inT.from !== user || outT.to !== user
  const wethLeg = inT.token === WETH || outT.token === WETH
  if (relayed && !wethLeg) return null

  // V2 token0/token1 are address-sorted. Cross-check the Transfer graph
  // against the pair event so a coincidental pair-shaped log set is rejected.
  const inIsToken0 = inT.token.toLowerCase() < outT.token.toLowerCase()
  const eventAmountIn = inIsToken0 ? amount0In : amount1In
  const eventAmountOut = inIsToken0 ? amount1Out : amount0Out
  if (eventAmountIn !== inT.value || eventAmountOut !== outT.value) return null

  return {
    pair,
    recipient: getAddress(to),
    tokenIn: { address: inT.token, amount: inT.value },
    tokenOut: { address: outT.token, amount: outT.value },
    reserveIn: inIsToken0 ? reserve0 : reserve1,
    reserveOut: inIsToken0 ? reserve1 : reserve0,
    tokenInRelayed: inT.from !== user,
    tokenOutRelayed: outT.to !== user,
  }
}
