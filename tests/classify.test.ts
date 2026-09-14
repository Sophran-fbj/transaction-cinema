import { describe, expect, it } from 'vitest'
import { classifyTx } from '../src/lib/classify/kinds'
import {
  loadErc20ApprovalLimitedFixture,
  loadErc20ApprovalUnlimitedFixture,
  loadErc20TransferFixture,
  loadNativeTransferFixture,
} from '../src/lib/fetch/fixture'

// Fixtures are frozen real mainnet txs — classification rules are exercised
// against actual RPC data, then edge shapes are produced by mutation.

describe('classifyTx', () => {
  it('classifies an empty-calldata value move as nativeTransfer', () => {
    const kind = classifyTx(loadNativeTransferFixture())
    expect(kind).toEqual({ kind: 'nativeTransfer' })
  })

  it('classifies a single-log Transfer tx as erc20Transfer with the parsed event', () => {
    const bundle = loadErc20TransferFixture()
    const kind = classifyTx(bundle)
    expect(kind.kind).toBe('erc20Transfer')
    if (kind.kind !== 'erc20Transfer') return
    expect(kind.transfer.value).toBe(1_500_000_000n) // 1500 USDT, 6 decimals
    expect(kind.transfer.token.toLowerCase()).toBe('0xdac17f958d2ee523a2206206994597c13d831ec7')
    expect(kind.transfer.from).toBe(bundle.tx.from)
  })

  it('classifies a single-log Approval tx as erc20Approval with the parsed event', () => {
    const bundle = loadErc20ApprovalLimitedFixture()
    const kind = classifyTx(bundle)
    expect(kind.kind).toBe('erc20Approval')
    if (kind.kind !== 'erc20Approval') return
    expect(kind.approval.value).toBe(30_000_000n) // 30 USDT, 6 decimals
    expect(kind.approval.owner).toBe(bundle.tx.from)
    expect(kind.approval.token.toLowerCase()).toBe('0xdac17f958d2ee523a2206206994597c13d831ec7')
  })

  it('classifies unlimited approvals the same way — mode is builder concern', () => {
    const kind = classifyTx(loadErc20ApprovalUnlimitedFixture())
    expect(kind.kind).toBe('erc20Approval')
    if (kind.kind !== 'erc20Approval') return
    expect(kind.approval.value).toBe(2n ** 256n - 1n)
  })

  it('classifies calldata with unknown selector as unknown', () => {
    const bundle = structuredClone(loadNativeTransferFixture())
    bundle.tx.input = '0x12345678deadbeef' as typeof bundle.tx.input
    expect(classifyTx(bundle)).toEqual({ kind: 'unknown', selector: '0x12345678' })
  })

  it('classifies reverted first — reverts discard logs, so intent is all we know', () => {
    const bundle = structuredClone(loadErc20TransferFixture())
    bundle.receipt.status = 'reverted'
    const kind = classifyTx(bundle)
    expect(kind.kind).toBe('reverted')
    if (kind.kind !== 'reverted') return
    expect(kind.selector).toBe('0xa9059cbb')
    // the intent is re-derived from calldata since no logs survive
    expect(kind.intent.type).toBe('erc20Transfer')
  })

  it('sends multi-log transfers to unknown — swap territory, not a plain move', () => {
    const bundle = structuredClone(loadErc20TransferFixture())
    bundle.receipt.logs = [...bundle.receipt.logs, bundle.receipt.logs[0]]
    const kind = classifyTx(bundle)
    expect(kind.kind).toBe('unknown')
  })
})
