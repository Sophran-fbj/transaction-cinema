import { formatEther, formatGwei, formatUnits, getAddress } from 'viem'
import type { V3SwapSignal } from '../../decode/v3'
import type { TxBundle } from '../../fetch/types'
import { formatBlockTimestamp, shortenAddress } from '../../utils/format'
import { tickSpanFor, visualMassForToken } from '../semantics'
import type { Actor, Story } from '../types'

const DURATIONS = {
  opening: 2200,
  swap: 5800,
  gas: 2600,
  outro: 2800,
} as const

const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'

// The V3 film. The Swap event carries the full terminal state, so the story
// is: value flies into the liquidity tunnel, the price needle sweeps a
// trade-size-derived distance (tickSpan) and settles on the REAL terminal
// tick (sqrtPriceX96 straight from the event), and value flies back out.
// Only the needle's start is derived — its destination is claimed as data.
export function buildV3SwapStory(
  bundle: TxBundle,
  { swap }: { swap: V3SwapSignal },
): Story {
  const { tx, receipt, blockTimestamp } = bundle
  const user = getAddress(tx.from)
  const gasCostEth = receipt.gasUsed * receipt.effectiveGasPrice
  const gwei = Number(formatGwei(receipt.effectiveGasPrice)).toLocaleString('en-US')
  const timestamp = Number(blockTimestamp)

  const metaIn = bundle.tokenMeta[swap.tokenIn.address.toLowerCase()]
  const metaOut = bundle.tokenMeta[swap.tokenOut.address.toLowerCase()]
  const decimalsIn = metaIn?.decimals ?? 18
  const decimalsOut = metaOut?.decimals ?? 18
  const symIn = metaIn?.symbol ?? shortenAddress(swap.tokenIn.address)
  const symOut = metaOut?.symbol ?? shortenAddress(swap.tokenOut.address)
  const assumedDecimals = !metaIn || !metaOut

  const displayIn = formatUnits(swap.tokenIn.amount, decimalsIn)
  const displayOut = formatUnits(swap.tokenOut.amount, decimalsOut)

  // execution price from the real amounts — honest and overflow-free, unlike
  // squaring a uint160 sqrtPriceX96 in float
  const unitsIn = Number(displayIn)
  const unitsOut = Number(displayOut)
  const priceLabel =
    Number.isFinite(unitsIn) && unitsIn > 0
      ? `1 ${symIn} = ${unitsOut / unitsIn < 0.0001 ? (unitsOut / unitsIn).toExponential(2) : (unitsOut / unitsIn).toLocaleString('en-US', { maximumFractionDigits: 4 })} ${symOut}`
      : undefined

  const poolInfo = bundle.poolInfo[swap.pool.toLowerCase()]
  const poolLabel = poolInfo?.label ?? 'V3 Pool'
  const feeLabel = poolInfo?.feeLabel ?? ''

  // ETH bridging: the router wraps native ETH into WETH on the way in (relayed
  // leg + the tx carries value) or unwraps on the way out (relayed WETH leg).
  // A direct wallet↔pool WETH hop is just WETH — no bridge, no rename.
  const isEthIn = swap.tokenIn.address === WETH && swap.tokenInRelayed && tx.value > 0n
  const isEthOut = swap.tokenOut.address === WETH && swap.tokenOutRelayed
  const inLabel = isEthIn ? 'ETH' : symIn
  const outLabel = isEthOut ? 'ETH' : symOut

  const cast: Record<string, Actor> = {
    user: { id: 'user', kind: 'eoa', label: shortenAddress(user), address: user },
    pool: { id: 'pool', kind: 'pool', label: poolLabel, address: swap.pool },
    tokenIn: { id: 'tokenIn', kind: 'token', label: symIn, address: swap.tokenIn.address },
    tokenOut: { id: 'tokenOut', kind: 'token', label: symOut, address: swap.tokenOut.address },
    gas: { id: 'gas', kind: 'gas', label: 'Gas' },
  }

  const scenes: Story['scenes'] = [
    {
      type: 'opening',
      durationMs: DURATIONS.opening,
      caption: {
        line: 'A trader approaches a liquidity tunnel.',
        sub: `Ethereum · block ${receipt.blockNumber.toLocaleString('en-US')}`,
      },
    },
    {
      type: 'swapV3',
      durationMs: DURATIONS.swap,
      pool: 'pool',
      tokenIn: 'tokenIn',
      tokenOut: 'tokenOut',
      amountIn: swap.tokenIn.amount,
      amountOut: swap.tokenOut.amount,
      displayIn,
      displayOut,
      visualMassIn: visualMassForToken(swap.tokenIn.amount, decimalsIn),
      visualMassOut: visualMassForToken(swap.tokenOut.amount, decimalsOut),
      endTick: swap.tick,
      sqrtPriceX96: swap.sqrtPriceX96,
      activeLiquidity: swap.liquidity,
      priceLabel,
      poolLabel,
      feeLabel,
      tickSpan: tickSpanFor(swap.tokenIn.amount, decimalsIn),
      assumedDecimals,
      caption: {
        line: `${displayIn} ${symIn}${isEthIn ? ' (your ETH, wrapped)' : ''} enters the tunnel — ${displayOut} ${symOut} comes out.`,
        sub: `${poolLabel}${feeLabel ? ` · ${feeLabel} fee tier` : ''} · price settles at tick ${swap.tick.toLocaleString('en-US')}`,
      },
    },
    {
      type: 'gas',
      durationMs: DURATIONS.gas,
      gasUsed: receipt.gasUsed,
      effectiveGasPrice: receipt.effectiveGasPrice,
      costEth: gasCostEth,
      caption: {
        line: 'The Gas Void takes its share.',
        sub: `${formatEther(gasCostEth)} ETH · ${gwei} gwei × ${receipt.gasUsed.toLocaleString('en-US')} units`,
      },
    },
    {
      type: 'outro',
      durationMs: DURATIONS.outro,
      caption: {
        line: 'Confirmed onchain.',
        sub: `Block ${receipt.blockNumber.toLocaleString('en-US')} · ${formatBlockTimestamp(timestamp)}`,
      },
    },
  ]

  return {
    txHash: tx.hash,
    chainLabel: 'Ethereum',
    status: 'success',
    title: `${inLabel} → ${outLabel}`,
    synopsis: `Swapped ${displayIn} ${inLabel} for ${displayOut} ${outLabel} on ${poolLabel}${isEthIn || isEthOut ? ' (wrapped as WETH)' : ''}`,
    cast,
    scenes,
    facts: {
      from: user,
      to: tx.to,
      value: tx.value,
      methodLabel: `${poolLabel} Swap`,
      blockNumber: receipt.blockNumber,
      timestamp,
      gasUsed: receipt.gasUsed,
      effectiveGasPrice: receipt.effectiveGasPrice,
      gasCostEth,
    },
  }
}
