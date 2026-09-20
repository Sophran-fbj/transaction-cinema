import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '../src/app/api/rpc/route'

// The proxy is the one piece of the pipeline that mutates behavior across
// requests (its LRU cache is module-global), so its contract is pinned here
// with a stubbed upstream fetch — no network, no real RPC.

const PROXY_URL = 'http://localhost:3000/api/rpc'

function rpcBody(method: string, params: unknown[] = [], id: number | string = 1) {
  return { jsonrpc: '2.0' as const, id, method, params }
}

interface JsonRpcResponse {
  id: number | string | null
  result?: unknown
  error?: { code: number; message: string }
}

function upstreamResponse(result: unknown) {
  return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result }), {
    headers: { 'content-type': 'application/json' },
  })
}

// Unique 32-byte hashes per test — the LRU is module-global and shared.
const txHash = (byte: string) => `0x${byte.repeat(32)}` as `0x${string}`

let upstream: ReturnType<typeof vi.fn>

beforeEach(() => {
  upstream = vi.fn(async () => new Response('upstream error', { status: 500 }))
  vi.stubGlobal('fetch', upstream)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function post(body: unknown): Promise<{ status: number; json: JsonRpcResponse | JsonRpcResponse[] }> {
  const response = await POST(
    new Request(PROXY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return { status: response.status, json: await response.json() }
}

describe('rpc proxy · caching', () => {
  it('REGRESSION: a pending tx (truthy result, blockNumber null) is not cached', async () => {
    const hash = txHash('a1')
    // 1st upstream call: pending. 2nd: mined. A cache hit would skip call 2.
    let calls = 0
    upstream.mockImplementation(async () => {
      calls += 1
      return upstreamResponse(calls === 1 ? { hash, blockNumber: null } : { hash, blockNumber: '0x10d4e3' })
    })

    const pending = await post(rpcBody('eth_getTransactionByHash', [hash]))
    expect((pending.json as JsonRpcResponse).result).toEqual({ hash, blockNumber: null })
    const mined = await post(rpcBody('eth_getTransactionByHash', [hash]))
    expect((mined.json as JsonRpcResponse).result).toEqual({ hash, blockNumber: '0x10d4e3' })
    // now the mined snapshot is cached — a third read costs no upstream call
    await post(rpcBody('eth_getTransactionByHash', [hash]))
    expect(upstream).toHaveBeenCalledTimes(2)
  })

  it('caches a mined tx and receipts after the first fetch', async () => {
    const hash = txHash('b2')
    upstream.mockImplementation(async () =>
      upstreamResponse({ hash, blockNumber: '0x10d4e3', status: '0x1' }),
    )

    await post(rpcBody('eth_getTransactionByHash', [hash]))
    await post(rpcBody('eth_getTransactionByHash', [hash]))
    await post(rpcBody('eth_getTransactionReceipt', [hash]))
    await post(rpcBody('eth_getTransactionReceipt', [hash]))
    expect(upstream).toHaveBeenCalledTimes(2)
  })

  it('never caches eth_call (state-dependent) or non-historical blocks', async () => {
    upstream.mockImplementation(async () => upstreamResponse('0x1'))

    await post(rpcBody('eth_call', [{ to: '0x1' }, 'latest']))
    await post(rpcBody('eth_call', [{ to: '0x1' }, 'latest']))
    expect(upstream).toHaveBeenCalledTimes(2)

    await post(rpcBody('eth_getBlockByNumber', ['latest', false]))
    await post(rpcBody('eth_getBlockByNumber', ['latest', false]))
    expect(upstream).toHaveBeenCalledTimes(4)
  })
})

describe('rpc proxy · guardrails', () => {
  it('rejects non-read methods before touching the upstream', async () => {
    const { json } = await post(rpcBody('eth_sendRawTransaction', ['0xdeadbeef']))
    const body = json as JsonRpcResponse
    expect(body.error?.code).toBe(-32601) // JSON-RPC error, not a transport failure
    expect(upstream).not.toHaveBeenCalled()
  })

  it('caps batch fan-out', async () => {
    const batch = Array.from({ length: 21 }, (_, i) => rpcBody('eth_chainId', [], i + 1))
    const { status, json } = await post(batch)
    expect(status).toBe(400)
    expect((json as JsonRpcResponse).error?.code).toBe(-32600)
    expect(upstream).not.toHaveBeenCalled()
  })

  it('advances to the next upstream when one answers 200 with an error body', async () => {
    // a provider refusal with HTTP 200 (e.g. a keywall) must not be passed
    // through as the answer — the next healthy upstream wins
    upstream.mockImplementation(async (url: unknown) => {
      if (String(url).includes('1rpc')) return upstreamResponse('0x1')
      return new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          error: { code: -32000, message: 'Unauthorized' },
        }),
        { headers: { 'content-type': 'application/json' } },
      )
    })
    const { json } = await post(rpcBody('eth_chainId'))
    expect((json as JsonRpcResponse).result).toBe('0x1')
  })

  it('serves a batch with results aligned to request order', async () => {
    // echo the request id the way a real upstream does
    upstream.mockImplementation(async (_url: unknown, init?: { body?: string }) => {
      const body = JSON.parse(init?.body ?? '{}')
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: '0x1' }), {
        headers: { 'content-type': 'application/json' },
      })
    })
    const { json } = await post([
      rpcBody('eth_chainId', [], 7),
      rpcBody('eth_blockNumber', [], 8),
    ])
    const responses = json as JsonRpcResponse[]
    expect(responses.map((r) => r.id)).toEqual([7, 8])
    expect(responses.every((r) => r.result === '0x1')).toBe(true)
  })
})
