import { describe, expect, it } from 'vitest'
import { classifyTx } from '../src/lib/classify/kinds'
import { detectV2Swap } from '../src/lib/decode/v2'
import { loadV2SwapFixture } from '../src/lib/fetch/fixture'
import { buildStory } from '../src/lib/story/build'

// Real Uniswap V2 UNI/WETH pair swap, routed through a caller contract. The
// pair's factory() is the canonical Uniswap V2 factory; the frozen receipt is
// still the only input to pure detection and story tests.
describe('detectV2Swap', () => {
  it('cross-checks the pair event against transfers and terminal reserves', () => {
    const bundle = loadV2SwapFixture()
    const swap = detectV2Swap(bundle.receipt, bundle.tx.to)
    if (!swap) throw new Error('expected a V2 swap signal')

    expect(swap.pair.toLowerCase()).toBe('0xd3d2e2692501a5c9ca623199d38826e513033a17')
    expect(swap.tokenIn.address.toLowerCase()).toBe('0x1f9840a85d5af5bf1d1762f925bdaddc4201f984')
    expect(swap.tokenIn.amount).toBe(197_012_294_449_339_269_120n)
    expect(swap.tokenOut.address.toLowerCase()).toBe('0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2')
    expect(swap.tokenOut.amount).toBe(643_637_833_492_705_664n)
    expect(swap.reserveIn).toBeGreaterThan(swap.tokenIn.amount)
    expect(swap.reserveOut).toBeGreaterThan(swap.tokenOut.amount)
  })

  it('rejects receipts outside the one-pair, two-transfer shape', () => {
    const bundle = structuredClone(loadV2SwapFixture())
    bundle.receipt.logs = [...bundle.receipt.logs, bundle.receipt.logs[0]]
    expect(detectV2Swap(bundle.receipt, bundle.tx.to)).toBeNull()
  })
})

describe('classifyTx · v2Swap', () => {
  it('classifies the fixture as a V2 swap', () => {
    expect(classifyTx(loadV2SwapFixture()).kind).toBe('v2Swap')
  })
})

describe('buildStory · v2 swap', () => {
  const story = buildStory(loadV2SwapFixture())

  it('plays opening → constant-product swap → gas → outro', () => {
    expect(story.scenes.map((scene) => scene.type)).toEqual([
      'opening',
      'swapV2',
      'gas',
      'outro',
    ])
    expect(story.title).toBe('UNI → WETH')
    expect(story.synopsis).toContain('Uniswap V2')
  })

  it('carries exact amounts, reserves and attribution into the scene', () => {
    const scene = story.scenes[1]
    if (scene.type !== 'swapV2') throw new Error('expected swapV2 scene')
    expect(scene.displayIn).toBe('197.01229444933926912')
    expect(scene.displayOut).toBe('0.643637833492705664')
    expect(scene.poolLabel).toBe('Uniswap V2')
    expect(scene.feeLabel).toBe('0.3%')
    expect(scene.displayReserveIn).not.toBe('0')
    expect(scene.displayReserveOut).not.toBe('0')
    expect(scene.priceLabel).toContain('1 UNI =')
  })

  it('derives all visual parameters from the decoded amounts and reserves', () => {
    const scene = story.scenes[1]
    if (scene.type !== 'swapV2') throw new Error('expected swapV2 scene')
    expect(scene.visualMassIn).toBeGreaterThan(0)
    expect(scene.visualMassOut).toBeGreaterThan(0)
    expect(scene.reserveLevelIn).toBeGreaterThanOrEqual(0.25)
    expect(scene.reserveLevelOut).toBeLessThanOrEqual(0.92)
  })
})
