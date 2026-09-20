import { createPublicClient, fallback, http, type HttpTransportConfig } from 'viem'
import { mainnet } from 'viem/chains'

// RPC-first architecture: raw JSON-RPC against public endpoints.
// No indexing APIs (Etherscan & co) — everything shown on screen is decoded
// by this app from raw transaction / receipt / block data.
//
// SECURITY: anything prefixed NEXT_PUBLIC_ is inlined into the browser bundle
// and visible to every visitor. Never point NEXT_PUBLIC_RPC_URL at an
// endpoint carrying a secret key — use the server-side proxy instead
// (src/app/api/rpc, fed by the server-only RPC_URL), which keeps keys off the
// client and caches immutable reads.

// Used everywhere the browser talks to RPC directly; when the same-origin
// proxy is available it is tried first.
const PUBLIC_RPC_URLS = [
  'https://ethereum-rpc.publicnode.com',
  'https://eth.llamarpc.com',
  'https://rpc.ankr.com/eth',
]

function rpcUrls(): string[] {
  const urls: string[] = []
  // Browser: the same-origin Route Handler first (server-only RPC_URL, tx
  // cache). Skipped outside the browser so the proxy can never hit itself.
  if (typeof window !== 'undefined') {
    urls.push(new URL('/api/rpc', window.location.origin).toString())
  }
  if (process.env.NEXT_PUBLIC_RPC_URL) urls.push(process.env.NEXT_PUBLIC_RPC_URL)
  urls.push(...PUBLIC_RPC_URLS)
  return urls
}

// viem's http transport already retries and bounds each request with a
// timeout; the one thing it cannot do on its own is cancel when the caller
// goes away — pass an AbortSignal to wire that up (see PlayerScreen).
export function createRpcClient(signal?: AbortSignal) {
  const fetchFn: HttpTransportConfig['fetchFn'] | undefined = signal
    ? (input, init) => fetch(input, { ...init, signal })
    : undefined
  return createPublicClient({
    chain: mainnet,
    // fallback() moves on to the next transport when one fails or rate-limits
    transport: fallback(rpcUrls().map((url) => http(url, fetchFn ? { fetchFn } : undefined))),
  })
}

export type RpcClient = ReturnType<typeof createRpcClient>

// Default client for non-interactive contexts (fixtures, tests, server code).
export const publicClient = createRpcClient()
