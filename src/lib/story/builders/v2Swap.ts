import { formatEther, formatGwei, formatUnits, getAddress } from 'viem'
import type { V2SwapSignal } from '../../decode/v2'
import type { TxBundle } from '../../fetch/types'
import { formatBlockTimestamp, shortenAddress } from '../../utils/format'
import { reserveLevelFor, visualMassForToken } from '../semantics'
import type { Actor, Story } from '../types'

const DURATIONS = {
  opening: 2200,
  swap: 5200,
  gas: 2600,
  outro: 2800,
} as const

export function buildV2SwapStory(
  bundle: TxBundle,
  { swap }: { swap: V2SwapSignal },
): Story {
  const { tx, receipt, blockTimestamp } = bundle
  const user = getAddress(tx.from)
  const gasCostEth = receipt.gasUsed * receipt.effectiveGasPrice
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
  const displayReserveIn = formatUnits(swap.reserveIn, decimalsIn)
  const displayReserveOut = formatUnits(swap.reserveOut, decimalsOut)
  const unitsIn = Number(displayIn)
  const unitsOut = Number(displayOut)
  const rate = unitsOut / unitsIn
  const priceLabel =
    Number.isFinite(rate) && rate > 0
      ? `1 ${symIn} = ${rate < 0.0001 ? rate.toExponential(2) : rate.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${symOut}`
      : undefined

  const poolInfo = bundle.poolInfo[swap.pair.toLowerCase()]
  const poolLabel = poolInfo?.label ?? 'V2 Pool'
  const feeLabel = poolInfo?.feeLabel ?? ''

  const cast: Record<string, Actor> = {
    user: { id: 'user', kind: 'eoa', label: shortenAddress(user), address: user },
    pair: { id: 'pair', kind: 'pool', label: poolLabel, address: swap.pair },
    tokenIn: { id: 'tokenIn', kind: 'token', label: symIn, address: swap.tokenIn.address },
    tokenOut: { id: 'tokenOut', kind: 'token', label: symOut, address: swap.tokenOut.address },
    gas: { id: 'gas', kind: 'gas', label: 'Gas' },
  }

  const scenes: Story['scenes'] = [
    {
      type: 'opening',
      durationMs: DURATIONS.opening,
      caption: {
        line: 'A trader approaches a constant-product pool.',
        sub: `Ethereum · block ${receipt.blockNumber.toLocaleString('en-US')}`,
      },
    },
    {
      type: 'swapV2',
      durationMs: DURATIONS.swap,
      pair: 'pair',
      tokenIn: 'tokenIn',
      tokenOut: 'tokenOut',
      amountIn: swap.tokenIn.amount,
      amountOut: swap.tokenOut.amount,
      displayIn,
      displayOut,
      visualMassIn: visualMassForToken(swap.tokenIn.amount, decimalsIn),
      visualMassOut: visualMassForToken(swap.tokenOut.amount, decimalsOut),
      reserveIn: swap.reserveIn,
      reserveOut: swap.reserveOut,
      displayReserveIn,
      displayReserveOut,
      reserveLevelIn: reserveLevelFor(swap.reserveIn, decimalsIn),
      reserveLevelOut: reserveLevelFor(swap.reserveOut, decimalsOut),
      priceLabel,
      poolLabel,
      feeLabel,
      assumedDecimals,
      caption: {
        line: `${displayIn} ${symIn} enters the pool — ${displayOut} ${symOut} leaves.`,
        sub: `${poolLabel}${feeLabel ? ` · ${feeLabel} fee` : ''} · reserves rebalance, x × y stays invariant`,
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
        sub: `${formatEther(gasCostEth)} ETH · ${Number(formatGwei(receipt.effectiveGasPrice)).toLocaleString('en-US')} gwei × ${receipt.gasUsed.toLocaleString('en-US')} units`,
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
    title: `${symIn} → ${symOut}`,
    synopsis: `Swapped ${displayIn} ${symIn} for ${displayOut} ${symOut} on ${poolLabel}`,
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
