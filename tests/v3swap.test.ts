import { describe, expect, it } from 'vitest'
import { detectV3Swap } from '../src/lib/decode/v3'
import { classifyTx } from '../src/lib/classify/kinds'
import { buildStory } from '../src/lib/story/build'
import { loadV3SwapFixture } from '../src/lib/fetch/fixture'

// Fixture: a real single-pool Uniswap V3 swap routed through the Universal
// Router — 383.54 USDC in, 0.1534 WETH out. Detection is event-shaped, so
// the router never had to be whitelisted.

describe('detectV3Swap', () => {
  it('extracts the terminal state and resolves in/out from the transfer graph', () => {
    const bundle = loadV3SwapFixture()
    const swap = detectV3Swap(bundle.receipt, bundle.tx.to)
    if (!swap) throw new Error('expected a V3 swap signal')
    expect(swap.pool.toLowerCase()).toBe('0xe0554a476a092703abdb3ef35c80e0d76d32939f')
    expect(swap.tokenIn.address.toLowerCase()).toBe('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48')
    expect(swap.tokenIn.amount).toBe(383_541_139n) // 383.541139 USDC
    expect(swap.tokenOut.address.toLowerCase()).toBe('0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2')
    expect(swap.tokenOut.amount).toBe(153_352_881_408_482_254n) // ≈0.1534 WETH
    // terminal state — the numbers the needle animation will show
    expect(swap.tick).toBe(198_076)
    expect(swap.liquidity).toBeGreaterThan(0n)
    expect(swap.sqrtPriceX96).toBeGreaterThan(0n)
    // exactly one signed direction: USDC in (+), WETH out (−)
    expect(swap.amount0).toBe(383_541_139n)
    expect(swap.amount1).toBe(-153_352_881_408_482_254n)
  })

  it('rejects receipts whose transfers do not form the user-pool-user shape', () => {
    const bundle = structuredClone(loadV3SwapFixture())
    bundle.receipt.logs = [...bundle.receipt.logs, bundle.receipt.logs[0]]
    expect(detectV3Swap(bundle.receipt, bundle.tx.to)).toBeNull()
  })
})

describe('classifyTx · v3Swap', () => {
  it('classifies the fixture as a v3 swap', () => {
    const kind = classifyTx(loadV3SwapFixture())
    expect(kind.kind).toBe('v3Swap')
  })
})

describe('buildStory · v3 swap', () => {
  const story = buildStory(loadV3SwapFixture())

  it('plays opening → swap → gas → outro', () => {
    expect(story.scenes.map((s) => s.type)).toEqual(['opening', 'swapV3', 'gas', 'outro'])
    expect(story.title).toBe('USDC → WETH')
    expect(story.synopsis).toContain('Uniswap V3')
  })

  it('carries the real terminal state into the scene', () => {
    const scene = story.scenes[1]
    if (scene.type !== 'swapV3') throw new Error('expected swapV3 scene')
    expect(scene.endTick).toBe(198_076)
    expect(scene.poolLabel).toBe('Uniswap V3')
    expect(scene.feeLabel).toBe('0.05%')
    expect(scene.displayIn).toBe('383.541139')
    expect(scene.displayOut).toBe('0.153352881408482254')
    // execution price derived from the real amounts
    expect(scene.priceLabel).toContain('1 USDC =')
  })

  it('maps amounts to visual mass through the semantics layer', () => {
    const scene = story.scenes[1]
    if (scene.type !== 'swapV3') throw new Error('expected swapV3 scene')
    expect(scene.visualMassIn).toBeGreaterThan(0)
    expect(scene.visualMassOut).toBeLessThanOrEqual(64)
    expect(scene.tickSpan).toBeGreaterThan(0)
  })
})
