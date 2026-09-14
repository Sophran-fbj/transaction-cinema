import { createPublicClient, fallback, http } from 'viem'
import { mainnet } from 'viem/chains'

// RPC-first architecture: raw JSON-RPC against public endpoints.
// No indexing APIs (Etherscan & co) — everything shown on screen is decoded
// by this app from raw transaction / receipt / block data.
// Set NEXT_PUBLIC_RPC_URL (e.g. a free Alchemy endpoint) to prioritize your own quota.
const RPC_URLS = [
  process.env.NEXT_PUBLIC_RPC_URL,
  'https://ethereum-rpc.publicnode.com',
  'https://eth.llamarpc.com',
  'https://rpc.ankr.com/eth',
].filter((url): url is string => Boolean(url))

export const publicClient = createPublicClient({
  chain: mainnet,
  // fallback() moves on to the next transport when one fails or rate-limits
  transport: fallback(RPC_URLS.map((url) => http(url))),
})
