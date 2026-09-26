// Same-origin RPC proxy. The browser never sees upstream credentials:
// RPC_URL is a server-only env var. It also bounds every upstream call with
// a timeout and caches stable reads within this server process, so replaying
// a confirmed transaction can avoid repeated upstream calls.
//
// Deliberately NOT a general-purpose relay: only the read methods the film
// pipeline needs are allowed through, and only immutable responses (mined
// txs, receipts, historical blocks) are cached.

// Same health-checked set as the browser list (see src/lib/chain/client.ts):
// RPC_URL first when configured, then drpc and 1rpc (full receipts), with
// publicnode last — its receipt lookups return null for older transactions.
const UPSTREAM_URLS = [
  process.env.RPC_URL,
  'https://eth.drpc.org',
  'https://1rpc.io/eth',
  'https://ethereum-rpc.publicnode.com',
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

const MAX_BODY_BYTES = 64 * 1024
const MAX_CALL_DATA_LENGTH = 32 * 1024 * 2 + 2
const MAX_BATCH = 20
const RATE_WINDOW_MS = 60_000
const MAX_REQUESTS_PER_WINDOW = 120
const MAX_OPERATIONS_PER_WINDOW = 240
const MAX_IN_FLIGHT_OPERATIONS = 40

let rateWindowEndsAt = 0
let requestsInWindow = 0
let operationsInWindow = 0
let inFlightOperations = 0

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isBlockTag(value: unknown): value is string {
  return typeof value === 'string' &&
    (/^0x[0-9a-f]{1,64}$/i.test(value) ||
      ['latest', 'pending', 'earliest', 'safe', 'finalized'].includes(value))
}

function isValidRequest(value: unknown): value is RpcRequestBody {
  if (!isRecord(value) || value.jsonrpc !== '2.0' || typeof value.method !== 'string') return false
  if (
    !('id' in value) ||
    !(value.id === null ||
      (typeof value.id === 'string' && value.id.length <= 64) ||
      (typeof value.id === 'number' && Number.isSafeInteger(value.id)))
  ) return false
  if (value.params !== undefined && !Array.isArray(value.params)) return false
  const params = value.params ?? []

  // Preserve the JSON-RPC "method not found" response for methods outside our allowlist.
  if (!ALLOWED_METHODS.has(value.method)) return value.method.length <= 64
  if (value.method === 'eth_chainId' || value.method === 'eth_blockNumber') {
    return params.length === 0
  }
  if (value.method === 'eth_getTransactionByHash' || value.method === 'eth_getTransactionReceipt') {
    return params.length === 1 && typeof params[0] === 'string' && /^0x[0-9a-f]{64}$/i.test(params[0])
  }
  if (value.method === 'eth_getBlockByNumber') {
    // Full transaction objects are not needed by the film and can be very large.
    return params.length === 2 && isBlockTag(params[0]) && params[1] === false
  }
  if (value.method === 'eth_call') {
    const call = params[0]
    return (params.length === 1 || params.length === 2) &&
      isRecord(call) &&
      typeof call.to === 'string' && /^0x[0-9a-f]{40}$/i.test(call.to) &&
      typeof call.data === 'string' && /^0x(?:[0-9a-f]{2})*$/i.test(call.data) &&
      call.data.length <= MAX_CALL_DATA_LENGTH &&
      (params.length === 1 || isBlockTag(params[1]))
  }
  return false
}

class PayloadTooLargeError extends Error {}

async function readBoundedJson(request: Request): Promise<unknown> {
  const declaredLength = Number(request.headers.get('content-length'))
  if (declaredLength > MAX_BODY_BYTES) throw new PayloadTooLargeError()
  if (!request.body) throw new SyntaxError('Empty body')

  const reader = request.body.getReader()
  const decoder = new TextDecoder()
  let bytes = 0
  let text = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      bytes += value.byteLength
      if (bytes > MAX_BODY_BYTES) {
        await reader.cancel()
        throw new PayloadTooLargeError()
      }
      text += decoder.decode(value, { stream: true })
    }
    text += decoder.decode()
    return JSON.parse(text) as unknown
  } finally {
    reader.releaseLock()
  }
}

function reserveCapacity(
  operations: number,
  countRequest = true,
): { retryAfter: number; release?: () => void } {
  const now = Date.now()
  if (now >= rateWindowEndsAt) {
    rateWindowEndsAt = now + RATE_WINDOW_MS
    requestsInWindow = 0
    operationsInWindow = 0
  }
  if ((countRequest && requestsInWindow >= MAX_REQUESTS_PER_WINDOW) ||
      operationsInWindow + operations > MAX_OPERATIONS_PER_WINDOW) {
    return { retryAfter: Math.max(1, Math.ceil((rateWindowEndsAt - now) / 1000)) }
  }
  if (inFlightOperations + operations > MAX_IN_FLIGHT_OPERATIONS) {
    return { retryAfter: 1 }
  }
  if (countRequest) requestsInWindow += 1
  operationsInWindow += operations
  inFlightOperations += operations
  return {
    retryAfter: 0,
    release: () => { inFlightOperations -= operations },
  }
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

function rpcSuccess(id: RpcRequestBody['id'], result: unknown) {
  return { jsonrpc: '2.0' as const, id, result }
}

function rateLimitedResponse(retryAfter: number): Response {
  return Response.json(rpcError(null, -32005, 'RPC rate limit exceeded'), {
    status: 429,
    headers: { 'Retry-After': String(retryAfter) },
  })
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
    if (cached !== undefined) return rpcSuccess(request.id, cached)
  }

  const body = JSON.stringify({
    jsonrpc: '2.0',
    id: request.id,
    method: request.method,
    params,
  })
  let upstreamError: ReturnType<typeof rpcError> | undefined
  for (const url of UPSTREAM_URLS) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        signal: AbortSignal.timeout(15_000),
      })
      if (!response.ok) continue
      const json = (await response.json()) as unknown
      if (!isRecord(json)) continue
      // A 200 carrying a JSON-RPC error body is a provider refusal (e.g. a
      // keywall or method block), not an answer — remember it and ask the
      // next upstream instead of passing the refusal through.
      if (json.error) {
        const error = isRecord(json.error) ? json.error : null
        upstreamError = rpcError(
          request.id,
          typeof error?.code === 'number' ? error.code : -32000,
          typeof error?.message === 'string' ? error.message : 'Upstream RPC error',
        )
        continue
      }
      if (!('result' in json)) continue
      if (isCacheable(request.method, params, json.result)) cacheSet(cacheKey, json.result)
      return rpcSuccess(request.id, json.result)
    } catch {
      // endpoint down / timed out — try the next one
    }
  }
  return upstreamError ?? rpcError(request.id, -32000, 'All upstream RPC endpoints failed')
}

// A batch fans out to N concurrent upstream calls, so bound it — viem only
// sends small batches; the cap exists so deliberate abuse cannot drain the
// upstream quota through this route.
// Accepts both a single JSON-RPC request and a batch (viem batches by default).
export async function POST(request: Request): Promise<Response> {
  // Count malformed requests too; otherwise parsing remains an unlimited path.
  const admission = reserveCapacity(0)
  if (!admission.release) return rateLimitedResponse(admission.retryAfter)
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    return Response.json(rpcError(null, -32600, 'Content-Type must be application/json'), { status: 415 })
  }
  let parsed: unknown
  try {
    parsed = await readBoundedJson(request)
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return Response.json(rpcError(null, -32600, 'Request body too large'), { status: 413 })
    }
    return Response.json(rpcError(null, -32700, 'Invalid JSON'), { status: 400 })
  }
  if (Array.isArray(parsed) && parsed.length > MAX_BATCH) {
    return Response.json(
      rpcError(null, -32600, `Batch too large (max ${MAX_BATCH} requests)`),
      { status: 400 },
    )
  }
  const requests = Array.isArray(parsed) ? parsed : [parsed]
  if (requests.length === 0 || !requests.every(isValidRequest)) {
    return Response.json(rpcError(null, -32600, 'Invalid RPC request'), { status: 400 })
  }
  const capacity = reserveCapacity(requests.length, false)
  if (!capacity.release) return rateLimitedResponse(capacity.retryAfter)
  try {
    const responses = await Promise.all(requests.map(forward))
    return Response.json(Array.isArray(parsed) ? responses : responses[0])
  } finally {
    capacity.release()
  }
}
