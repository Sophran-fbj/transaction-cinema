import { erc20Abi, getAddress, type Address } from 'viem'
import { multicall, readContract } from 'viem/actions'
import { publicClient, type RpcClient } from '../chain/client'
import type { PoolInfo, TokenMeta, TxBundle } from '../fetch/types'
import { decodeIntent } from './intent'
import { parseErc20Approvals, parseErc20Transfers } from './events'
import { UNISWAP_V2_FACTORY, detectV2Swap } from './v2'
import { UNISWAP_V3_FACTORY, detectV3Swap } from './v3'

// Enrichment bridge: decode-aware, fetch-executing. Finds token addresses in
// the logs (transfers or approvals) AND in the calldata intent (a reverted tx
// has no logs — its token only exists in the intent), multicalls
// name/symbol/decimals for each (one RPC round-trip), and returns a bundle
// with `tokenMeta` filled. Pure passthrough when no token shows up anywhere.
export async function enrichTokenMeta(
  bundle: TxBundle,
  client: RpcClient = publicClient,
): Promise<TxBundle> {
  const addresses = tokenAddressesForMeta(bundle).filter(
    (address) => !bundle.tokenMeta[address.toLowerCase()],
  )
  if (addresses.length === 0) return bundle

  const results = await multicall(client, {
    contracts: addresses.flatMap((address) => [
      { address, abi: erc20Abi, functionName: 'name' as const },
      { address, abi: erc20Abi, functionName: 'symbol' as const },
      { address, abi: erc20Abi, functionName: 'decimals' as const },
    ]),
    allowFailure: true,
  })

  const tokenMeta: Record<string, TokenMeta> = { ...bundle.tokenMeta }
  addresses.forEach((address, i) => {
    const name = results[i * 3]
    const symbol = results[i * 3 + 1]
    const decimals = results[i * 3 + 2]
    if (
      name.status !== 'success' ||
      symbol.status !== 'success' ||
      decimals.status !== 'success' ||
      typeof name.result !== 'string' ||
      typeof symbol.result !== 'string' ||
      typeof decimals.result !== 'number'
    ) {
      // A non-standard token or a failing call: leave it out — builders fall
      // back to honest raw display instead of wrong decimals.
      return
    }
    tokenMeta[address.toLowerCase()] = {
      address,
      symbol: symbol.result,
      name: name.result,
      decimals: decimals.result,
    }
  })

  return { ...bundle, tokenMeta }
}

// Token addresses this bundle could enrich: from Transfer/Approval events
// and — for reverted txs, which have no logs — from the calldata intent.
function tokenAddressesForMeta(bundle: TxBundle): Address[] {
  const events = [...parseErc20Transfers(bundle.receipt), ...parseErc20Approvals(bundle.receipt)]
  const intent = decodeIntent(bundle.tx)
  const intentToken =
    intent.type === 'erc20Transfer' || intent.type === 'erc20Approve' ? [intent.token] : []
  return [...new Set([...events.map((e) => e.token), ...intentToken])]
}

// V3 pools are identical bytecode across forks — the only honest way to say
// "Uniswap V3" is to ask the pool for its factory. fee() gives the tier.
const v3PoolReaderAbi = [
  { type: 'function', name: 'factory', stateMutability: 'view', outputs: [{ type: 'address' }], inputs: [] },
  { type: 'function', name: 'fee', stateMutability: 'view', outputs: [{ type: 'uint24' }], inputs: [] },
] as const

function feeTierLabel(fee: number): string {
  return `${(fee / 1e4).toString()}%` // 500 → 0.05%, 3000 → 0.3%, 10000 → 1%
}

export async function enrichPoolInfo(
  bundle: TxBundle,
  client: RpcClient = publicClient,
): Promise<TxBundle> {
  const v3Swap = detectV3Swap(bundle.receipt, bundle.tx.to)
  const v2Swap = v3Swap ? null : detectV2Swap(bundle.receipt, bundle.tx.to)
  if (!v3Swap && !v2Swap) return bundle
  const version = v3Swap ? 'v3' : 'v2'
  const pool = v3Swap?.pool ?? v2Swap!.pair
  if (bundle.poolInfo[pool.toLowerCase()]) return bundle

  const [factoryRes, feeRes] = await Promise.all([
    readContract(client, {
      address: pool,
      abi: v3PoolReaderAbi,
      functionName: 'factory',
    }),
    v3Swap
      ? readContract(client, {
          address: pool,
          abi: v3PoolReaderAbi,
          functionName: 'fee',
        })
      : Promise.resolve(undefined),
  ])
  const factory = getAddress(factoryRes)
  const isUniswap =
    factory.toLowerCase() ===
    (version === 'v3' ? UNISWAP_V3_FACTORY : UNISWAP_V2_FACTORY).toLowerCase()
  const label = isUniswap ? `Uniswap ${version.toUpperCase()}` : `${version.toUpperCase()} AMM`
  const poolInfo: Record<string, PoolInfo> = {
    ...bundle.poolInfo,
    [pool.toLowerCase()]: {
      address: pool,
      label,
      feeLabel: feeRes === undefined ? (isUniswap ? '0.3%' : '') : feeTierLabel(Number(feeRes)),
    },
  }
  return { ...bundle, poolInfo }
}

export interface EnrichmentOutcome {
  bundle: TxBundle
  // which OPTIONAL enhancements failed at the transport level and were
  // skipped — the film still plays, just with raw amounts / generic labels.
  degraded: { tokenMeta: boolean; poolInfo: boolean }
}

// Full enrichment pass, tolerant of partial failure. Once the base bundle
// (transaction + receipt + block) exists, metadata and pool attribution are
// enhancements, not preconditions: a transport-level failure in either is
// contained here (Promise.allSettled) instead of poisoning the whole film.
// `enrichers` is injectable so tests can simulate failures without RPC.
export async function enrichBundle(
  bundle: TxBundle,
  client: RpcClient = publicClient,
  enrichers: {
    tokenMeta?: (b: TxBundle, c: RpcClient) => Promise<TxBundle>
    poolInfo?: (b: TxBundle, c: RpcClient) => Promise<TxBundle>
  } = {},
): Promise<EnrichmentOutcome> {
  const [metaRes, poolRes] = await Promise.allSettled([
    (enrichers.tokenMeta ?? enrichTokenMeta)(bundle, client),
    (enrichers.poolInfo ?? enrichPoolInfo)(bundle, client),
  ])

  let enriched = bundle
  const degraded = { tokenMeta: false, poolInfo: false }
  if (metaRes.status === 'fulfilled') {
    enriched = { ...enriched, tokenMeta: metaRes.value.tokenMeta }
  } else if (tokenAddressesForMeta(bundle).length > 0) {
    // the multicall was actually attempted — the loss is user-visible
    degraded.tokenMeta = true
  }
  if (poolRes.status === 'fulfilled') {
    enriched = { ...enriched, poolInfo: poolRes.value.poolInfo }
  } else if (
    detectV3Swap(bundle.receipt, bundle.tx.to) ||
    detectV2Swap(bundle.receipt, bundle.tx.to)
  ) {
    degraded.poolInfo = true
  }
  return { bundle: enriched, degraded }
}
