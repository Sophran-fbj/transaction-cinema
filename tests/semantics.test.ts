import { describe, expect, it } from 'vitest'
import { visualMassForEth, visualMassForToken } from '../src/lib/story/semantics'

// The data→animation boundary, pinned: these numbers decide how heavy a value
// feels. If they change, the film changes — deliberately, and only here.

describe('visualMassForEth', () => {
  it('minimum one particle, even for dust', () => {
    expect(visualMassForEth(0n)).toBe(1)
    expect(visualMassForEth(1n)).toBe(1)
  })

  it('scales logarithmically', () => {
    expect(visualMassForEth(1_000_000_000_000_000_000n)).toBe(4) // 1 ETH
    expect(visualMassForEth(2_000_000_000_000_000_000n)).toBe(6) // 2 ETH
    expect(visualMassForEth(100n * 10n ** 18n)).toBe(24) // 100 ETH
  })

  it('caps at 64 particles', () => {
    expect(visualMassForEth(10n ** 27n)).toBe(64) // a billion ETH
  })
})

describe('visualMassForToken', () => {
  it('measures in human units after decimals', () => {
    expect(visualMassForToken(1_500_000_000n, 6)).toBe(38) // 1500 USDT
    expect(visualMassForToken(1_000_000n, 6)).toBe(4) // 1 USDT
  })

  it('survives absurd supplies without NaN', () => {
    expect(visualMassForToken(10n ** 40n, 18)).toBe(64)
  })
})
