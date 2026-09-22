import type { Address, Transaction, TransactionReceipt } from 'viem'

export interface TokenMeta {
  address: Address
  symbol: string
  name: string
  decimals: number
}

export interface PoolInfo {
  address: Address
  label: string // "Uniswap V2/V3" — honest attribution via factory()
  feeLabel: string // V2: "0.3%"; V3: "0.05%" / "0.3%" / "1%"
}

// Everything a story can be built from: the raw RPC triple plus decoded
// token metadata and pool attribution (both filled by enrichment).
export interface TxBundle {
  tx: Transaction
  receipt: TransactionReceipt
  blockTimestamp: bigint
  tokenMeta: Record<string, TokenMeta>
  poolInfo: Record<string, PoolInfo>
}
