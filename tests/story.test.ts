import { describe, expect, it } from 'vitest'
import { buildStory } from '../src/lib/story/build'
import {
  loadErc20ApprovalLimitedFixture,
  loadErc20ApprovalUnlimitedFixture,
  loadErc20TransferFixture,
  loadNativeTransferFixture,
} from '../src/lib/fetch/fixture'

// Story builders turn bundles into scene timelines; these tests pin the shape
// and the exact onchain values that end up on screen.

describe('buildStory · native transfer', () => {
  const story = buildStory(loadNativeTransferFixture())

  it('produces the four-act film', () => {
    expect(story.scenes.map((s) => s.type)).toEqual(['opening', 'transfer', 'gas', 'outro'])
  })

  it('carries the real value and gas math into facts', () => {
    expect(story.facts.value).toBe(2_000_000_000_000_000_000n)
    // 21000 gas × 2 gwei — straight from the receipt
    expect(story.facts.gasCostEth).toBe(21_000n * 2_000_000_000n)
    expect(story.facts.methodLabel).toBe('ETH Transfer')
  })

  it('hands the transfer scene the amount and its visual mass', () => {
    const transfer = story.scenes[1]
    if (transfer.type !== 'transfer') throw new Error('expected transfer scene')
    expect(transfer.amount).toBe(2_000_000_000_000_000_000n)
    expect(transfer.visualMass).toBe(6) // 12·log10(3) rounded
    expect(story.cast[transfer.asset]?.kind).toBe('native')
  })
})

describe('buildStory · erc20 transfer', () => {
  const story = buildStory(loadErc20TransferFixture())

  it('titles itself after the token and formats with real decimals', () => {
    expect(story.title).toBe('USDT Transfer')
    expect(story.synopsis).toContain('1500 USDT')
    const transfer = story.scenes[1]
    if (transfer.type !== 'transfer') throw new Error('expected transfer scene')
    expect(transfer.displayAmount).toBe('1500') // 1_500_000_000 raw / 10^6
    expect(transfer.amountNumber).toBe(1500)
    expect(transfer.assumedDecimals).toBeFalsy()
  })

  it('casts the token as an actor and moves zero native value', () => {
    const transfer = story.scenes[1]
    if (transfer.type !== 'transfer') throw new Error('expected transfer scene')
    expect(story.cast.token).toMatchObject({
      kind: 'token',
      label: 'USDT',
      address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    })
    expect(story.facts.value).toBe(0n) // tokens moved, ETH did not
  })

  it('computes gas from the real receipt', () => {
    expect(story.facts.gasUsed).toBe(63_197n) // 0xf6dd
  })
})

describe('buildStory · erc20 approval', () => {
  it('limited: grants a finite allowance with formatted amount', () => {
    const story = buildStory(loadErc20ApprovalLimitedFixture())
    expect(story.title).toBe('USDT Approval')
    const scene = story.scenes[1]
    if (scene.type !== 'approval') throw new Error('expected approval scene')
    expect(scene.mode).toBe('limited')
    expect(scene.displayAmount).toBe('30') // 30_000_000 raw / 10^6
    expect(scene.amountNumber).toBe(30)
    expect(story.cast.spender).toMatchObject({ kind: 'eoa' })
    expect(story.facts.methodLabel).toBe('ERC20 Approval · USDT')
  })

  it('unlimited: approve(max uint256) becomes an infinite-allowance story', () => {
    const story = buildStory(loadErc20ApprovalUnlimitedFixture())
    expect(story.title).toBe('USDC · Unlimited Approval')
    const scene = story.scenes[1]
    if (scene.type !== 'approval') throw new Error('expected approval scene')
    expect(scene.mode).toBe('unlimited')
    expect(scene.displayAmount).toBe('∞')
    expect(scene.amountNumber).toBeUndefined()
    expect(scene.caption.line).toContain('Unlimited')
  })

  it('revoke: approving zero is a different story from the same event shape', () => {
    const bundle = structuredClone(loadErc20ApprovalLimitedFixture())
    // mutate the raw event value in the receipt log data: 30 USDT → 0
    const log = bundle.receipt.logs[0] as unknown as { data: `0x${string}` }
    log.data = ('0x' + '0'.repeat(64)) as `0x${string}`
    const story = buildStory(bundle)
    expect(story.title).toBe('USDT Allowance Revoked')
    const scene = story.scenes[1]
    if (scene.type !== 'approval') throw new Error('expected approval scene')
    expect(scene.mode).toBe('revoke')
    expect(scene.displayAmount).toBe('0')
  })
})
