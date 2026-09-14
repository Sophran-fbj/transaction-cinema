import { publicClient } from '../chain/client'
import {
  rpcToBundle,
  type RawBlockHeader,
  type RawReceipt,
  type RawTransaction,
} from './rpcToBundle'
import type { TxBundle } from './types'

export class TxNotFoundError extends Error {
  constructor(hash: string) {
    super(`Transaction ${hash} not found. Is it a real Ethereum mainnet tx?`)
    this.name = 'TxNotFoundError'
  }
}

export class TxNotMinedError extends Error {
  constructor(hash: string) {
    super(`Transaction ${hash} is not mined yet — no receipt to tell a story from.`)
    this.name = 'TxNotMinedError'
  }
}

// Live path: three raw JSON-RPC calls, then the shared formatter.
// Deliberately not client.getTransaction(): keeping the wire format explicit
// means fixtures captured by scripts/capture-fixture.mjs feed the exact same
// rpcToBundle() — one source of truth for RPC-shape → app-shape.
export async function getTxBundle(hash: `0x${string}`): Promise<TxBundle> {
  const [transaction, receipt] = await Promise.all([
    publicClient.request({ method: 'eth_getTransactionByHash', params: [hash] }),
    publicClient.request({ method: 'eth_getTransactionReceipt', params: [hash] }),
  ])
  if (!transaction) throw new TxNotFoundError(hash)
  if (!receipt) throw new TxNotMinedError(hash)

  const block = await publicClient.request({
    method: 'eth_getBlockByNumber',
    params: [receipt.blockNumber, false],
  })

  return rpcToBundle(
    transaction as RawTransaction,
    receipt as RawReceipt,
    block as RawBlockHeader,
  )
}
