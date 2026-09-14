import {
  getAddress,
  parseEventLogs,
  type Address,
  type TransactionReceipt,
} from 'viem'
import { parseErc20Transfers } from './events'

// Uniswap V3 pool events. The Swap event carries the FULL terminal state:
// signed amounts (positive = pool received, negative = pool sent), the
// post-swap sqrtPriceX96 / active liquidity / tick. This is what makes the
// V3 story possible without traces or archive state.
const v3PoolAbi = [
  {
    type: 'event',
    name: 'Swap',
    inputs: [
      { name: 'sender', type: 'address', indexed: true },
      { name: 'recipient', type: 'address', indexed: true },
      { name: 'amount0', type: 'int256' },
      { name: 'amount1', type: 'int256' },
      { name: 'sqrtPriceX96', type: 'uint160' },
      { name: 'liquidity', type: 'uint128' },
      { name: 'tick', type: 'int24' },
    ],
  },
] as const

const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
export const UNISWAP_V3_FACTORY = '0x1F98431c8aD98523631AE4a59f267346ea31F984'

export interface V3SwapSignal {
  pool: Address
  recipient: Address
  // signed: positive = into the pool, negative = out of it
  amount0: bigint
  amount1: bigint
  // terminal state, straight from the event
  sqrtPriceX96: bigint
  liquidity: bigint
  tick: number
  // resolved against the transfer graph: what the user paid and received
  tokenIn: { address: Address; amount: bigint }
  tokenOut: { address: Address; amount: bigint }
}

// Detection is purely event-shaped: exactly one V3 Swap event, exactly two
// ERC20 Transfers forming X→pool and pool→Y where X/Y are the tx sender or
// the called contract (caller-relayed legs only make sense bridging ETH via
// WETH). Works for any router — Universal Router included — because the
// events themselves carry the whole story.
export function detectV3Swap(
  receipt: TransactionReceipt,
  caller: Address | null,
): V3SwapSignal | null {
  const swaps = parseEventLogs({
    abi: v3PoolAbi,
    eventName: 'Swap',
    logs: receipt.logs,
    strict: false,
  })
  if (swaps.length !== 1) return null
  const swap = swaps[0]

  const amount0 = swap.args.amount0
  const amount1 = swap.args.amount1
  const sqrtPriceX96 = swap.args.sqrtPriceX96
  const liquidity = swap.args.liquidity
  const tick = swap.args.tick
  if (
    amount0 === undefined ||
    amount1 === undefined ||
    sqrtPriceX96 === undefined ||
    liquidity === undefined ||
    tick === undefined ||
    swap.args.recipient === undefined
  ) {
    return null
  }
  // a plain swap moves one token in and one out — exactly one signed positive
  if (amount0 > 0n === amount1 > 0n) return null

  const pool = getAddress(swap.address)
  const user = getAddress(receipt.from)
  const transfers = parseErc20Transfers(receipt)
  if (transfers.length !== 2) return null

  const inT = transfers.find((t) => (t.from === user || t.from === caller) && t.to === pool)
  const outT = transfers.find((t) => t.from === pool && (t.to === user || t.to === caller))
  if (!inT || !outT) return null

  // caller-relayed legs are ETH bridging — only WETH makes that honest
  const relayed = inT.from !== user || outT.to !== user
  const wethLeg = inT.token === WETH || outT.token === WETH
  if (relayed && !wethLeg) return null

  // cross-check direction against the Swap event's signed amounts:
  // token0 < token1 by address; amount0 > 0 means token0 flowed IN
  const inIsToken0 = inT.token.toLowerCase() < outT.token.toLowerCase()
  const swapIn = inIsToken0 ? amount0 : amount1
  const swapOut = inIsToken0 ? -amount1 : -amount0
  if (swapIn !== inT.value || swapOut !== outT.value) return null

  return {
    pool,
    recipient: getAddress(swap.args.recipient),
    amount0,
    amount1,
    sqrtPriceX96,
    liquidity,
    tick,
    tokenIn: { address: inT.token, amount: inT.value },
    tokenOut: { address: outT.token, amount: outT.value },
  }
}
