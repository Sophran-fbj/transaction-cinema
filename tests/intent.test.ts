import { describe, expect, it } from 'vitest'
import { getAddress } from 'viem'
import { decodeIntent } from '../src/lib/decode/intent'
import { classifyTx } from '../src/lib/classify/kinds'
import { buildStory } from '../src/lib/story/build'
import { loadFailedTxFixture } from '../src/lib/fetch/fixture'

// The fixture is a real reverted tx: approve(~10 trillion UNI) that the chain
// rejected. Its receipt has ZERO logs — the proof that reverted txs discard
// events, and the reason intent comes from calldata.

describe('decodeIntent', () => {
  it('decodes the approve intent from calldata alone', () => {
    const fixture = loadFailedTxFixture()
    const intent = decodeIntent(fixture.tx)
    expect(intent).toEqual({
      type: 'erc20Approve',
      token: getAddress(fixture.tx.to!), // getAddress is the checksum authority
      spender: getAddress('0x54c4237f0b277b57bca8363570b31241d66e5584'),
      value: 9_999_999_999_999_000_000_000_000_000_000n,
    })
  })

  it('decodes empty calldata as a native transfer intent', () => {
    const bundle = structuredClone(loadFailedTxFixture())
    bundle.tx.input = '0x'
    const intent = decodeIntent(bundle.tx)
    expect(intent.type).toBe('nativeTransfer')
  })

  it('falls back to unknown for selectors outside the known ABI', () => {
    const bundle = structuredClone(loadFailedTxFixture())
    bundle.tx.input = '0x12345678deadbeef' as typeof bundle.tx.input
    const intent = decodeIntent(bundle.tx)
    expect(intent).toEqual({ type: 'unknown', selector: '0x12345678' })
  })
})

describe('classifyTx · reverted', () => {
  it('carries the decoded intent in the kind payload', () => {
    const kind = classifyTx(loadFailedTxFixture())
    expect(kind.kind).toBe('reverted')
    if (kind.kind !== 'reverted') return
    expect(kind.intent.type).toBe('erc20Approve')
    expect(kind.selector).toBe('0x095ea7b3')
  })
})

describe('buildStory · reverted', () => {
  const story = buildStory(loadFailedTxFixture())

  it('plays the five-act failure film', () => {
    expect(story.scenes.map((s) => s.type)).toEqual([
      'opening',
      'approval',
      'revert',
      'gas',
      'outro',
    ])
    expect(story.status).toBe('reverted')
    expect(story.title).toBe('Failed UNI Approval')
  })

  it('marks the intent scene as attempted', () => {
    const intent = story.scenes[1]
    if (intent.type !== 'approval') throw new Error('expected approval scene')
    expect(intent.caption.sub).toContain('attempted')
    expect(intent.amount).toBe(9_999_999_999_999_000_000_000_000_000_000n)
    expect(intent.amountNumber).toBe(9999999999999)
  })

  it('plays the revert as a stamp-only scene for approval intents', () => {
    // approvals rewind nothing: the badge already flew in the intent scene,
    // so the revert is the stamp, the shake, the desaturation — no particles
    const rewind = story.scenes[2]
    if (rewind.type !== 'revert') throw new Error('expected revert scene')
    expect(rewind.asset).toBeUndefined()
    expect(rewind.amount).toBeUndefined()
  })

  it('ends with the one line every failed tx shares', () => {
    expect(story.scenes[4].caption.line).toBe('Nothing changed onchain. Except the gas.')
    expect(story.facts.gasCostEth).toBe(23_007n * 42_051_517n) // from the real receipt
  })
})
