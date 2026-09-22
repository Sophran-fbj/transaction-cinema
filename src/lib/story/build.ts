import type { TxBundle } from '../fetch/types'
import { classifyTx, type TxKind } from '../classify/kinds'
import { buildErc20ApprovalStory } from './builders/erc20Approval'
import { buildErc20TransferStory } from './builders/erc20Transfer'
import { buildNativeTransferStory } from './builders/nativeTransfer'
import { buildRevertedStory } from './builders/reverted'
import { buildV2SwapStory } from './builders/v2Swap'
import { buildV3SwapStory } from './builders/v3Swap'
import { buildUnknownStory } from './builders/unknown'
import type { Story } from './types'

// Each kind maps to a builder that receives the bundle plus the narrowed kind
// payload (e.g. the parsed Transfer event) — no re-parsing downstream.
type BuilderMap = {
  [K in TxKind as K['kind']]?: (bundle: TxBundle, kind: K) => Story
}

// Registry pattern: new tx kinds register a builder here; anything without
// one degrades to the designed unknown story instead of crashing.
const BUILDERS: BuilderMap = {
  nativeTransfer: buildNativeTransferStory,
  erc20Transfer: buildErc20TransferStory,
  erc20Approval: buildErc20ApprovalStory,
  v2Swap: buildV2SwapStory,
  v3Swap: buildV3SwapStory,
  reverted: buildRevertedStory,
}

export function buildStory(bundle: TxBundle): Story {
  const kind = classifyTx(bundle)
  const builder = BUILDERS[kind.kind] as
    | ((bundle: TxBundle, kind: TxKind) => Story)
    | undefined
  return builder ? builder(bundle, kind) : buildUnknownStory(bundle)
}
