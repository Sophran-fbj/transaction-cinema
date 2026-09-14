import nativeRaw from '../../fixtures/native-transfer/0x83a429974a3270dd66c7a79cadbcfb4f1e3778978556b52c4de9c87eb871f653.json'
import erc20Raw from '../../fixtures/erc20-transfer/0x3876a9b88de5054abd2925b0dc2503b36af3406aee70dbeda5067399b0f29825.json'
import approvalLimitedRaw from '../../fixtures/erc20-approval/0x081a7d09c1158dd4d594a33ab9829e1f1e0e227eef49c39ece4dedb4d3acbfd5.json'
import approvalUnlimitedRaw from '../../fixtures/erc20-approval/0x668afe8af152c3e3275ce81ab9b245ff7ae603f007fa950a6e75bc88e13b8831.json'
import failedRaw from '../../fixtures/failed-tx/0xa5ac0a2aace0e5746f981adabc44913cf46aa3fedc2026caabd3a594a912a3d9.json'
import v3SwapRaw from '../../fixtures/uniswap-v3-swap/0xfc27562d1a9aa37c3a1a145d75f71908b3f1ee9bb1d54d5a0d3a8c2913bae0a6.json'
import ethBridgedRaw from '../../fixtures/eth-bridged-swap/0x4a5003ec93b14d06d27547f844f0008dae826b9076587d5de87b86be881706ee.json'
import {
  rpcToBundle,
  type RawBlockHeader,
  type RawReceipt,
  type RawTransaction,
} from './rpcToBundle'
import type { TxBundle } from './types'

// Fixtures are frozen raw RPC responses (see scripts/capture-fixture.mjs).
// They power offline development and deterministic tests of the pure pipeline —
// same input shapes as the live path, same rpcToBundle formatter.
interface RawFixtureFile {
  transaction: RawTransaction
  receipt: RawReceipt
  block: RawBlockHeader
}

function fromRaw(raw: RawFixtureFile): TxBundle {
  return rpcToBundle(raw.transaction, raw.receipt, raw.block)
}

const native = nativeRaw as unknown as RawFixtureFile
const erc20 = erc20Raw as unknown as RawFixtureFile
const approvalLimited = approvalLimitedRaw as unknown as RawFixtureFile
const approvalUnlimited = approvalUnlimitedRaw as unknown as RawFixtureFile
const failed = failedRaw as unknown as RawFixtureFile

export function loadNativeTransferFixture(): TxBundle {
  return fromRaw(native)
}

// metadata injected the way enrichTokenMeta would have fetched it online —
// tests stay offline and deterministic. The token address is passed explicitly
// because a reverted tx has no logs to read it from.
function withTokenMeta(
  bundle: TxBundle,
  token: string,
  meta: { symbol: string; name: string; decimals: number },
): TxBundle {
  const address = token as `0x${string}`
  return {
    ...bundle,
    tokenMeta: {
      [token.toLowerCase()]: { address, ...meta },
    },
  }
}

export function loadErc20TransferFixture(): TxBundle {
  return withTokenMeta(fromRaw(erc20), erc20Raw.receipt.logs[0].address, {
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
  })
}

export function loadErc20ApprovalLimitedFixture(): TxBundle {
  return withTokenMeta(fromRaw(approvalLimited), approvalLimitedRaw.receipt.logs[0].address, {
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
  })
}

export function loadErc20ApprovalUnlimitedFixture(): TxBundle {
  return withTokenMeta(fromRaw(approvalUnlimited), approvalUnlimitedRaw.receipt.logs[0].address, {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
  })
}

export function loadFailedTxFixture(): TxBundle {
  // the UNI contract this failed approve targeted — intent token, no logs exist
  return withTokenMeta(fromRaw(failed), failedRaw.transaction.to, {
    symbol: 'UNI',
    name: 'Uniswap',
    decimals: 18,
  })
}

// A real single-pool V3 swap: 383.54 USDC → 0.1534 WETH via Universal Router.
// Metadata + pool attribution injected the way enrichment would fetch online.
export function loadV3SwapFixture(): TxBundle {
  const bundle = fromRaw(v3SwapRaw)
  const pool = '0xe0554a476a092703abdb3ef35c80e0d76d32939f'
  return {
    ...bundle,
    tokenMeta: {
      ['0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48']: {
        address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
      },
      ['0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2']: {
        address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        symbol: 'WETH',
        name: 'Wrapped Ether',
        decimals: 18,
      },
    },
    poolInfo: {
      [pool]: { address: pool, label: 'Uniswap V3', feeLabel: '0.05%' },
    },
  }
}

export const NATIVE_TRANSFER_DEMO_HASH = nativeRaw.hash as `0x${string}`
export const ERC20_TRANSFER_DEMO_HASH = erc20Raw.hash as `0x${string}`
export const APPROVAL_DEMO_HASH = approvalUnlimitedRaw.hash as `0x${string}`
export const FAILED_TX_DEMO_HASH = failedRaw.hash as `0x${string}`
// A real ETH-bridged single-pool swap: 0.158 ETH in (router wraps to WETH,
// refunds the ~0.0004 change), 400 USDC out, via Universal Router.
export function loadEthBridgedSwapFixture(): TxBundle {
  const bundle = fromRaw(ethBridgedRaw)
  const pool = '0xe0554a476a092703abdb3ef35c80e0d76d32939f'
  return {
    ...bundle,
    tokenMeta: {
      ['0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2']: {
        address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        symbol: 'WETH',
        name: 'Wrapped Ether',
        decimals: 18,
      },
      ['0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48']: {
        address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
      },
    },
    poolInfo: {
      [pool]: { address: pool, label: 'Uniswap V3', feeLabel: '0.05%' },
    },
  }
}

export const V3_SWAP_DEMO_HASH = v3SwapRaw.hash as `0x${string}`
export const ETH_BRIDGED_SWAP_DEMO_HASH = ethBridgedRaw.hash as `0x${string}`
