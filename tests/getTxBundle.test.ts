import { describe, expect, it, vi } from 'vitest'
import type { RpcClient } from '../src/lib/chain/client'
import {
  ReceiptUnavailableError,
  TxNotMinedError,
  getTxBundle,
} from '../src/lib/fetch/getTxBundle'

// Pins the contract that mined-ness is judged by the TRANSACTION's
// blockNumber, never by a null receipt — public endpoints have been observed
// returning result:null receipts for long-mined transactions, which used to
// surface as a false "not mined yet".

const HASH = `0x${'ab'.repeat(32)}` as `0x${string}`
const BLOCK = '0x18c4455'

const rawTx = (mined: boolean) => ({
  blockHash: mined ? `0x${'1'.repeat(64)}` : null,
  blockNumber: mined ? BLOCK : null,
  from: '0x1111111111111111111111111111111111111111',
  gas: '0x5208',
  gasPrice: '0x1',
  hash: HASH,
  input: '0x',
  nonce: '0x1',
  to: '0x2222222222222222222222222222222222222222',
  transactionIndex: '0x0',
  value: '0xde0b6b3a7640000',
  type: '0x0',
  v: '0x1',
  r: `0x${'01'.repeat(32)}`,
  s: `0x${'02'.repeat(32)}`,
})

const rawReceipt = {
  transactionHash: HASH,
  transactionIndex: '0x0',
  blockHash: `0x${'1'.repeat(64)}`,
  blockNumber: BLOCK,
  from: '0x1111111111111111111111111111111111111111',
  to: '0x2222222222222222222222222222222222222222',
  cumulativeGasUsed: '0x5208',
  gasUsed: '0x5208',
  logs: [],
  logsBloom: `0x${'00'.repeat(256)}`,
  type: '0x0',
  status: '0x1',
  effectiveGasPrice: '0x1',
}

const rawBlock = { number: BLOCK, timestamp: '0x662f0018' }

// fake client: `handle(method, attempt#)` returns the response for the
// attempt-th call of that method (attempt starts at 1)
function fakeClient(handle: (method: string, attempt: number) => unknown): {
  client: RpcClient
  calls: (method: string) => number
} {
  const seen: string[] = []
  const request = vi.fn(async ({ method }: { method: string }) => {
    const attempt = seen.filter((m) => m === method).length + 1
    seen.push(method)
    return handle(method, attempt)
  })
  return {
    client: { request } as unknown as RpcClient,
    calls: (method) => seen.filter((m) => m === method).length,
  }
}

describe('getTxBundle · mined-ness is the transaction\'s claim', () => {
  it('returns the bundle when tx, receipt and block all answer', async () => {
    const { client } = fakeClient((method) => {
      if (method === 'eth_getTransactionByHash') return rawTx(true)
      if (method === 'eth_getTransactionReceipt') return rawReceipt
      return rawBlock
    })
    const bundle = await getTxBundle(HASH, client)
    expect(bundle.tx.hash).toBe(HASH)
    expect(bundle.blockTimestamp).toBe(BigInt('0x662f0018'))
  })

  it('REGRESSION: null receipt for a MINED tx retries once, then errors honestly', async () => {
    const { client, calls } = fakeClient((method) => {
      if (method === 'eth_getTransactionByHash') return rawTx(true)
      return null // receipt null on both attempts
    })
    await expect(getTxBundle(HASH, client)).rejects.toBeInstanceOf(ReceiptUnavailableError)
    expect(calls('eth_getTransactionReceipt')).toBe(2)
  })

  it('recovers when the receipt retry succeeds', async () => {
    const { client, calls } = fakeClient((method, attempt) => {
      if (method === 'eth_getTransactionByHash') return rawTx(true)
      if (method === 'eth_getTransactionReceipt') return attempt === 1 ? null : rawReceipt
      return rawBlock
    })
    const bundle = await getTxBundle(HASH, client)
    expect(bundle.receipt.status).toBe('success')
    expect(calls('eth_getTransactionReceipt')).toBe(2)
  })

  it('reports not-mined only when the transaction itself is pending', async () => {
    const { client, calls } = fakeClient((method) => {
      if (method === 'eth_getTransactionByHash') return rawTx(false)
      return null
    })
    await expect(getTxBundle(HASH, client)).rejects.toBeInstanceOf(TxNotMinedError)
    // pending: no retry — the receipt legitimately does not exist yet
    expect(calls('eth_getTransactionReceipt')).toBe(1)
  })
})
