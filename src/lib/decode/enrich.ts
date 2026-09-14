import { erc20Abi, getAddress } from 'viem'
import { multicall, readContract } from 'viem/actions'
import { publicClient } from '../chain/client'
import type { PoolInfo, TokenMeta, TxBundle } from '../fetch/types'
import { decodeIntent } from './intent'
import { parseErc20Approvals, parseErc20Transfers } from './events'
import { UNISWAP_V3_FACTORY, detectV3Swap } from './v3'

// Enrichment bridge: decode-aware, fetch-executing. Finds token addresses in
// the logs (transfers or approvals) AND in the calldata intent (a reverted tx
// has no logs — its token only exists in the intent), multicalls
// name/symbol/decimals for each (one RPC round-trip), and returns a bundle
// with `tokenMeta` filled. Pure passthrough when no token shows up anywhere.
export async function enrichTokenMeta(bundle: TxBundle): Promise<TxBundle> {
  const events = [
    ...parseErc20Transfers(bundle.receipt),
    ...parseErc20Approvals(bundle.receipt),
  ]
  const intent = decodeIntent(bundle.tx)
  const intentToken =
    intent.type === 'erc20Transfer' || intent.type === 'erc20Approve' ? [intent.token] : []

  const addresses = [...new Set([...events.map((e) => e.token), ...intentToken])].filter(
    (address) => !bundle.tokenMeta[address.toLowerCase()],
  )
  if (addresses.length === 0) return bundle

  const results = await multicall(publicClient, {
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

// V3 pools are identical bytecode across forks — the only honest way to say
// "Uniswap V3" is to ask the pool for its factory. fee() gives the tier.
const v3PoolReaderAbi = [
  { type: 'function', name: 'factory', stateMutability: 'view', outputs: [{ type: 'address' }], inputs: [] },
  { type: 'function', name: 'fee', stateMutability: 'view', outputs: [{ type: 'uint24' }], inputs: [] },
] as const

function feeTierLabel(fee: number): string {
  return `${(fee / 1e4).toString()}%` // 500 → 0.05%, 3000 → 0.3%, 10000 → 1%
}

export async function enrichPoolInfo(bundle: TxBundle): Promise<TxBundle> {
  const swap = detectV3Swap(bundle.receipt, bundle.tx.to)
  if (!swap) return bundle
  const pool = swap.pool
  if (bundle.poolInfo[pool.toLowerCase()]) return bundle

  const [factoryRes, feeRes] = await Promise.all([
    readContract(publicClient, {
      address: pool,
      abi: v3PoolReaderAbi,
      functionName: 'factory',
    }),
    readContract(publicClient, {
      address: pool,
      abi: v3PoolReaderAbi,
      functionName: 'fee',
    }),
  ])

  const label =
    getAddress(factoryRes).toLowerCase() === UNISWAP_V3_FACTORY.toLowerCase()
      ? 'Uniswap V3'
      : 'V3 AMM'
  const poolInfo: Record<string, PoolInfo> = {
    ...bundle.poolInfo,
    [pool.toLowerCase()]: {
      address: pool,
      label,
      feeLabel: feeTierLabel(Number(feeRes)),
    },
  }
  return { ...bundle, poolInfo }
}
