import {
  parseErc20Approvals,
  parseErc20Transfers,
  type Erc20ApprovalEvent,
  type Erc20TransferEvent,
} from '../decode/events'
import { decodeIntent, type DecodedIntent } from '../decode/intent'
import { detectV3Swap, type V3SwapSignal } from '../decode/v3'
import type { TxBundle } from '../fetch/types'
import { calldataSelector } from '../utils/selector'

// The classification result is a discriminated union: every downstream stage
// (story builders, tests) narrows on `kind` and TypeScript proves we handled it.
// The union grows as stages land: uniswapSwap…
export type TxKind =
  | { kind: 'nativeTransfer' }
  | { kind: 'erc20Transfer'; transfer: Erc20TransferEvent }
  | { kind: 'erc20Approval'; approval: Erc20ApprovalEvent }
  | { kind: 'v3Swap'; swap: V3SwapSignal }
  | { kind: 'reverted'; selector: `0x${string}` | null; intent: DecodedIntent }
  | { kind: 'unknown'; selector: `0x${string}` | null }

// Rule order encodes EVM semantics:
// 1. A reverted tx emits no logs (events are discarded on revert), so its
//    story can only be built from calldata intent — the reverted kind.
// 2. input === '0x' means no calldata: the tx can only be a plain value move.
// 3. Exactly one event and nothing else = a plain single-act story:
//    a Transfer is a token move, an Approval is an allowance change.
//    More events than that is swap territory (later stage).
export function classifyTx({ tx, receipt }: TxBundle): TxKind {
  const selector = calldataSelector(tx.input)
  if (receipt.status === 'reverted') {
    // no logs survive a revert — the story must be built from calldata intent
    return { kind: 'reverted', selector, intent: decodeIntent(tx) }
  }
  if (tx.input === '0x' && tx.to !== null) return { kind: 'nativeTransfer' }

  const transfers = parseErc20Transfers(receipt)
  if (transfers.length === 1 && receipt.logs.length === 1) {
    return { kind: 'erc20Transfer', transfer: transfers[0] }
  }
  const approvals = parseErc20Approvals(receipt)
  if (approvals.length === 1 && receipt.logs.length === 1) {
    return { kind: 'erc20Approval', approval: approvals[0] }
  }
  const v3Swap = detectV3Swap(receipt, tx.to)
  if (v3Swap) return { kind: 'v3Swap', swap: v3Swap }
  return { kind: 'unknown', selector }
}
