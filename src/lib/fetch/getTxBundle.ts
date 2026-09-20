import { publicClient, type RpcClient } from '../chain/client'
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

export class ReceiptUnavailableError extends Error {
  constructor(hash: string) {
    super(
      `The endpoint did not return the receipt for ${hash}, although the transaction is mined — try again.`,
    )
    this.name = 'ReceiptUnavailableError'
  }
}

// Live path: three raw JSON-RPC calls, then the shared formatter.
// Deliberately not client.getTransaction(): keeping the wire format explicit
// means fixtures captured by scripts/capture-fixture.mjs feed the exact same
// rpcToBundle() — one source of truth for RPC-shape → app-shape.
// `client` is injectable so callers can abort (PlayerScreen passes one wired
// to an AbortSignal); the shared publicClient is used otherwise.
export async function getTxBundle(
  hash: `0x${string}`,
  client: RpcClient = publicClient,
): Promise<TxBundle> {
  const [transaction, firstReceipt] = await Promise.all([
    client.request({ method: 'eth_getTransactionByHash', params: [hash] }),
    client.request({ method: 'eth_getTransactionReceipt', params: [hash] }),
  ])
  if (!transaction) throw new TxNotFoundError(hash)
  const rawTx = transaction as RawTransaction

  // The transaction itself is the authority on mined-ness: blockNumber is
  // set the moment it lands in a block. A null receipt for a mined tx is an
  // endpoint malfunction (seen in the wild: providers returning result:null
  // for older receipts), never the chain's truth — so "not mined" is only
  // reported when the TRANSACTION says so, and a missing receipt for a mined
  // tx gets one retry before surfacing as a retryable error. viem's fallback
  // cannot do this: a null result is a valid answer to it, so the first
  // transport's null would be accepted as final.
  if (!firstReceipt && rawTx.blockNumber === null) throw new TxNotMinedError(hash)
  const receipt = firstReceipt
    ? (firstReceipt as RawReceipt)
    : ((await client.request({
        method: 'eth_getTransactionReceipt',
        params: [hash],
      })) as RawReceipt | null)
  if (!receipt) throw new ReceiptUnavailableError(hash)

  const block = await client.request({
    method: 'eth_getBlockByNumber',
    params: [receipt.blockNumber as `0x${string}`, false],
  })

  return rpcToBundle(rawTx, receipt, block as RawBlockHeader)
}
