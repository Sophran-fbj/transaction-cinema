import { describe, expect, it } from 'vitest'
import type { RpcClient } from '../src/lib/chain/client'
import { enrichBundle } from '../src/lib/decode/enrich'
import {
  loadErc20TransferFixture,
  loadNativeTransferFixture,
  loadV2SwapFixture,
  loadV3SwapFixture,
} from '../src/lib/fetch/fixture'

// Enrichment is an ENHANCEMENT on top of the base bundle: this suite pins the
// contract that a transport-level failure in token metadata or pool
// attribution degrades the film honestly instead of killing it.

const okClient = {} as RpcClient // never touched — enrichers are injected

describe('enrichBundle · partial failure', () => {
  it('merges both enrichments when both succeed', async () => {
    const bundle = loadV3SwapFixture()
    const { bundle: enriched, degraded } = await enrichBundle(bundle, okClient, {
      tokenMeta: async (b) => ({ ...b, tokenMeta: { extra: { address: '0x1', symbol: 'X', name: 'X', decimals: 18 } } }),
      poolInfo: async (b) => b,
    })
    expect(degraded).toEqual({ tokenMeta: false, poolInfo: false })
    expect(enriched.poolInfo).toEqual(bundle.poolInfo)
    expect(Object.keys(enriched.tokenMeta)).toContain('extra')
  })

  it('keeps the film alive and flags tokenMeta when the multicall dies', async () => {
    // strip pre-injected fixture metadata so the enrichment is genuinely needed
    const bundle = { ...loadErc20TransferFixture(), tokenMeta: {} }
    const { bundle: enriched, degraded } = await enrichBundle(bundle, okClient, {
      tokenMeta: async () => {
        throw new Error('transport down')
      },
      poolInfo: async (b) => b,
    })
    expect(degraded.tokenMeta).toBe(true)
    expect(degraded.poolInfo).toBe(false)
    // base bundle survives untouched — the story can still be built
    expect(enriched.receipt).toBe(bundle.receipt)
    expect(enriched.tx).toBe(bundle.tx)
  })

  it('flags pool attribution loss only for real V2/V3 swaps', async () => {
    const swapBundle = { ...loadV3SwapFixture(), poolInfo: {} }
    const v2Bundle = { ...loadV2SwapFixture(), poolInfo: {} }
    const nativeBundle = loadNativeTransferFixture()

    const swap = await enrichBundle(swapBundle, okClient, {
      poolInfo: async () => {
        throw new Error('transport down')
      },
    })
    expect(swap.degraded.poolInfo).toBe(true)

    const v2 = await enrichBundle(v2Bundle, okClient, {
      poolInfo: async () => {
        throw new Error('transport down')
      },
    })
    expect(v2.degraded.poolInfo).toBe(true)

    // no pool swap in a plain transfer → nothing user-visible was lost
    const native = await enrichBundle(nativeBundle, okClient, {
      poolInfo: async () => {
        throw new Error('transport down')
      },
    })
    expect(native.degraded.poolInfo).toBe(false)
  })

  it('does not flag tokenMeta for txs with no token signals at all', async () => {
    const nativeBundle = loadNativeTransferFixture()
    const { degraded } = await enrichBundle(nativeBundle, okClient, {
      tokenMeta: async () => {
        throw new Error('transport down')
      },
    })
    expect(degraded.tokenMeta).toBe(false)
  })
})
