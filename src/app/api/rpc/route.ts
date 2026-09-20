// Same-origin RPC proxy. The browser never sees upstream credentials:
// RPC_URL is a server-only env var. It also bounds every upstream call with
// a timeout and caches the immutable reads this app makes, so replaying a
// confirmed transaction costs one upstream call — then zero.
//
// Deliberately NOT a general-purpose relay: only the read methods the film
// pipeline needs are allowed through, and only immutable responses (mined
// txs, receipts, historical blocks) are cached.

const UPSTREAM_URLS = [
  process.env.RPC_URL,
  'https://ethereum-rpc.publicnode.com',
  'https://eth.llamarpc.com',
  'https://rpc.ankr.com/eth',
].filter((url): url is string => Boolean(url))

const ALLOWED_METHODS = new Set([
  'eth_chainId',
  'eth_blockNumber',
  'eth_call',
  'eth_getTransactionByHash',
  'eth_getTransactionReceipt',
  'eth_getBlockByNumber',
])

type RpcRequestBody = {
  jsonrpc: '2.0'
  id: number | string | null
  method: string
  params?: unknown[]
}

// eth_getBlockByNumber is only immutable for a concrete block number —
// 'latest' would freeze the tip forever.
function isImmutable(method: string, params: unknown[]): boolean {
  if (method === 'eth_getBlockByNumber') {
    return typeof params[0] === 'string' && /^0x[0-9a-f]+$/i.test(params[0])
  }
  return method === 'eth_getTransactionByHash' || method === 'eth_getTransactionReceipt'
}

// A pending tx is truthy but still mutable: eth_getTransactionByHash returns
// { blockNumber: null } until it is mined. Caching that snapshot would put a
// permanent "not mined yet" in front of the player's Retry button — only
// cache the tx once it has a block. (Receipts are null while pending, so
// they never hit this trap.)
function isCacheable(method: string, params: unknown[], result: unknown): boolean {
  if (!isImmutable(method, params) || !result) return false
  if (method === 'eth_getTransactionByHash') {
    const blockNumber = (result as { blockNumber?: unknown }).blockNumber
    return typeof blockNumber === 'string' && /^0x[0-9a-f]+$/i.test(blockNumber)
  }
  return true
}

// Tiny LRU: confirmed txs/receipts/blocks are forever-immutable, so eviction
// is only a memory bound, not a correctness concern.
const CACHE_MAX = 300
const cache = new Map<string, unknown>()

function cacheGet(key: string): unknown {
  const value = cache.get(key)
  if (value === undefined) return undefined
  cache.delete(key)
  cache.set(key, value) // refresh LRU position
  return value
}

function cacheSet(key: string, value: unknown): void {
  if (cache.has(key)) cache.delete(key)
  cache.set(key, value)
  if (cache.size > CACHE_MAX) {
    cache.delete(cache.keys().next().value as string)
  }
}

function rpcError(id: RpcRequestBody['id'], code: number, message: string) {
  return { jsonrpc: '2.0' as const, id: id ?? null, error: { code, message } }
}

async function forward(request: RpcRequestBody): Promise<unknown> {
  if (!ALLOWED_METHODS.has(request.method)) {
    return rpcError(request.id, -32601, `Method not allowed: ${request.method}`)
  }
  const params = request.params ?? []
  const cacheKey = `${request.method}:${JSON.stringify(params)}`
  const immutable = isImmutable(request.method, params)
  if (immutable) {
    const cached = cacheGet(cacheKey)
    if (cached !== undefined) return cached
  }

  const body = JSON.stringify({
    jsonrpc: '2.0',
    id: request.id ?? 1,
    method: request.method,
    params,
  })
  for (const url of UPSTREAM_URLS) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        signal: AbortSignal.timeout(15_000),
      })
      if (!response.ok) continue
      const json = (await response.json()) as Record<string, unknown>
      if (isCacheable(request.method, params, json.result)) cacheSet(cacheKey, json)
      return json
    } catch {
      // endpoint down / timed out — try the next one
    }
  }
  return rpcError(request.id, -32000, 'All upstream RPC endpoints failed')
}

// A batch fans out to N concurrent upstream calls, so bound it — viem only
// sends small batches; the cap exists so deliberate abuse cannot drain the
// upstream quota through this route.
const MAX_BATCH = 20

// Accepts both a single JSON-RPC request and a batch (viem batches by default).
export async function POST(request: Request): Promise<Response> {
  let parsed: RpcRequestBody | RpcRequestBody[]
  try {
    parsed = (await request.json()) as RpcRequestBody | RpcRequestBody[]
  } catch {
    return Response.json(rpcError(null, -32700, 'Invalid JSON'), { status: 400 })
  }
  if (Array.isArray(parsed) && parsed.length > MAX_BATCH) {
    return Response.json(
      rpcError(null, -32600, `Batch too large (max ${MAX_BATCH} requests)`),
      { status: 400 },
    )
  }
  const requests = Array.isArray(parsed) ? parsed : [parsed]
  const responses = await Promise.all(requests.map(forward))
  return Response.json(Array.isArray(parsed) ? responses : responses[0])
}
