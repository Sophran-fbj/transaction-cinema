import type { Address } from 'viem'

export type ActorId = string

export type ActorKind = 'eoa' | 'token' | 'native' | 'router' | 'pool' | 'gas'

export interface Actor {
  id: ActorId
  kind: ActorKind
  label: string
  address?: Address
}

export interface Caption {
  line: string
  sub?: string
}

interface SceneCommon {
  durationMs: number
  caption: Caption
}

// The Story IR. Renderer components switch on `type` only — they never know
// what a Uniswap swap or an approval is. New tx kinds add scene payloads here.
export type Scene =
  | (SceneCommon & { type: 'opening' })
  | (SceneCommon & {
      type: 'transfer'
      from: ActorId
      to: ActorId
      asset: ActorId
      amount: bigint
      visualMass: number
      // Token transfers pre-format in the builder (it owns tokenMeta); the
      // renderer stays dumb and never re-derives decimals.
      displayAmount?: string
      amountNumber?: number
      assumedDecimals?: boolean
      // failed-tx intent: particles never reach the recipient — they hang
      // mid-air, waiting for a world that is about to say no
      interrupted?: boolean
    })
  | (SceneCommon & {
      type: 'approval'
      owner: ActorId
      spender: ActorId
      token: ActorId
      mode: 'limited' | 'unlimited' | 'revoke'
      amount: bigint
      displayAmount?: string // '∞' for unlimited
      amountNumber?: number
      assumedDecimals?: boolean
      // failed-tx intent: the badge flies, but the lock must stay closed —
      // the allowance never actually changed
      attempted?: boolean
    })
  | (SceneCommon & {
      type: 'gas'
      gasUsed: bigint
      effectiveGasPrice: bigint
      costEth: bigint
    })
  | (SceneCommon & {
      type: 'swapV3'
      pool: ActorId
      tokenIn: ActorId
      tokenOut: ActorId
      amountIn: bigint
      amountOut: bigint
      displayIn?: string
      displayOut?: string
      visualMassIn: number
      visualMassOut: number
      // terminal state — REAL, straight from the Swap event
      endTick: number
      sqrtPriceX96: bigint
      activeLiquidity: bigint
      // derived from the real amounts (execution price, no uint160 overflow)
      priceLabel?: string
      poolLabel: string // "Uniswap V3" via factory()
      feeLabel: string // "0.05%"
      // stylized: how far the needle sweeps (visual only, start is derived)
      tickSpan: number
      assumedDecimals?: boolean
    })
  | (SceneCommon & {
      type: 'revert'
      // mirror of the interrupted intent for the rewind; omitted fields mean
      // a generic "the chain said no" (stamp only, no particles to rewind)
      from?: ActorId
      to?: ActorId
      asset?: ActorId
      amount?: bigint
      visualMass?: number
      displayAmount?: string
      amountNumber?: number
    })
  | (SceneCommon & { type: 'outro' })

export interface StoryFacts {
  from: Address
  to: Address | null
  value: bigint
  methodLabel: string
  blockNumber: bigint
  timestamp: number
  gasUsed: bigint
  effectiveGasPrice: bigint
  gasCostEth: bigint
}

export interface Story {
  txHash: `0x${string}`
  chainLabel: string
  status: 'success' | 'reverted'
  title: string
  synopsis: string
  cast: Record<ActorId, Actor>
  scenes: Scene[]
  facts: StoryFacts
}
