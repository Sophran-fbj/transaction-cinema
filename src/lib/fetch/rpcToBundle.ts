import {
  formatTransaction,
  formatTransactionReceipt,
  getAddress,
  type Transaction,
  type TransactionReceipt,
} from 'viem'
import type { TxBundle } from './types'

// Raw JSON-RPC shapes: every quantity is a 0x-prefixed hex string. These are
// exactly what a node returns — and exactly what fixture files store — so the
// live path and the fixture path share this single formatter.
export interface RawTransaction {
  blockHash: string
  blockNumber: string
  from: string
  gas: string
  gasPrice?: string
  maxFeePerGas?: string
  maxPriorityFeePerGas?: string
  hash: string
  input: string
  nonce: string
  to: string | null
  transactionIndex: string
  value: string
  type: string
  chainId?: string
  v?: string
  r?: string
  s?: string
  accessList?: unknown[]
}

export interface RawLog {
  address: string
  topics: string[]
  data: string
  blockNumber: string
  transactionHash: string
  transactionIndex: string
  blockHash: string
  logIndex: string
  removed: boolean
}

export interface RawReceipt {
  transactionHash: string
  transactionIndex: string
  blockHash: string
  blockNumber: string
  from: string
  to: string | null
  cumulativeGasUsed: string
  gasUsed: string
  logs: RawLog[]
  logsBloom: string
  type: string
  status: string
  effectiveGasPrice: string
}

export interface RawBlockHeader {
  number: string
  timestamp: string
}

export function rpcToBundle(
  transaction: RawTransaction,
  receipt: RawReceipt,
  block: RawBlockHeader,
): TxBundle {
  const tx = formatTransaction(
    transaction as unknown as Parameters<typeof formatTransaction>[0],
  ) as Transaction
  // Normalize addresses at the boundary: RPC returns lowercase, event decoding
  // returns checksummed — one convention (checksummed) everywhere downstream.
  const normalizedTx = {
    ...tx,
    from: getAddress(tx.from),
    to: tx.to === null ? null : getAddress(tx.to),
  }
  return {
    tx: normalizedTx,
    receipt: formatTransactionReceipt(
      receipt as unknown as Parameters<typeof formatTransactionReceipt>[0],
    ) as TransactionReceipt,
    blockTimestamp: BigInt(block.timestamp),
    tokenMeta: {},
    poolInfo: {},
  }
}
