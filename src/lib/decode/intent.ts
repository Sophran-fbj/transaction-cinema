import {
  decodeFunctionData,
  getAddress,
  isAddress,
  type Address,
  type Transaction,
} from 'viem'
import { erc20Abi } from 'viem'
import { calldataSelector } from '../utils/selector'

// Calldata intent decoding — the only story source for reverted txs, since a
// revert discards every event. Two tiers:
//   1. erc20Abi function decode: transfer/approve/transferFrom anywhere
//      (calldata decode is per-ABI, but the ERC20 ABI applies to any token)
//   2. anything else: unknown — show the raw 4-byte selector, never pretend.
// "Intent" is honest wording: we decode what the tx TRIED to do, with zero
// claim that it happened.

export type DecodedIntent =
  | { type: 'nativeTransfer'; to: Address; value: bigint }
  | { type: 'erc20Transfer'; token: Address; to: Address; value: bigint }
  | { type: 'erc20Approve'; token: Address; spender: Address; value: bigint }
  | { type: 'unknown'; selector: `0x${string}` | null }

export function decodeIntent(tx: Transaction): DecodedIntent {
  if (tx.input === '0x') {
    // no calldata: the only possible intent was moving value
    return tx.to !== null
      ? { type: 'nativeTransfer', to: tx.to, value: tx.value }
      : { type: 'unknown', selector: null }
  }

  try {
    const { functionName, args } = decodeFunctionData({ abi: erc20Abi, data: tx.input })
    // for all ERC20 entry points the token is simply the called contract
    if (tx.to === null) return { type: 'unknown', selector: calldataSelector(tx.input) }
    const token = getAddress(tx.to)

    if (functionName === 'transfer') {
      const [to, value] = args as [Address, bigint]
      if (isAddress(to)) return { type: 'erc20Transfer', token, to: getAddress(to), value }
    }
    if (functionName === 'approve') {
      const [spender, value] = args as [Address, bigint]
      if (isAddress(spender)) return { type: 'erc20Approve', token, spender: getAddress(spender), value }
    }
    if (functionName === 'transferFrom') {
      // V1 keeps the signer as the protagonist and drops args[0] (the `from`
      // whose allowance is consumed) — one hero per film.
      const [, to, value] = args as [Address, Address, bigint]
      if (isAddress(to)) return { type: 'erc20Transfer', token, to: getAddress(to), value }
    }
  } catch {
    // selector does not match erc20Abi — fall through to unknown
  }

  return { type: 'unknown', selector: calldataSelector(tx.input) }
}
