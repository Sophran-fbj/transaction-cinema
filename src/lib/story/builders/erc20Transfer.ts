import { formatEther, formatGwei, formatUnits } from 'viem'
import type { Erc20TransferEvent } from '../../decode/events'
import type { TxBundle } from '../../fetch/types'
import { formatBlockTimestamp, shortenAddress } from '../../utils/format'
import { visualMassForToken } from '../semantics'
import type { Actor, Story } from '../types'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

const DURATIONS = {
  opening: 2200,
  transfer: 3600,
  gas: 2600,
  outro: 2800,
} as const

// A single ERC20 Transfer event, straight from the logs. Mint (from = 0x0) and
// burn (to = 0x0) are caption variants of the same kind — the event is the
// truth, only the wording changes.
export function buildErc20TransferStory(
  bundle: TxBundle,
  { transfer }: { transfer: Erc20TransferEvent },
): Story {
  const { tx, receipt, blockTimestamp } = bundle
  const meta = bundle.tokenMeta[transfer.token.toLowerCase()]

  // Honest fallback when metadata could not be fetched: raw-ish display with
  // the assumption stated, instead of confidently wrong decimals.
  const decimals = meta?.decimals ?? 18
  const assumedDecimals = !meta
  const symbol = meta?.symbol ?? 'TOKEN'
  const displayAmount = formatUnits(transfer.value, decimals)
  const amountNumber = Number(displayAmount)

  const isMint = transfer.from.toLowerCase() === ZERO_ADDRESS
  const isBurn = transfer.to.toLowerCase() === ZERO_ADDRESS
  const gasCostEth = receipt.gasUsed * receipt.effectiveGasPrice
  const gwei = Number(formatGwei(receipt.effectiveGasPrice)).toLocaleString('en-US')
  const timestamp = Number(blockTimestamp)

  const tokenLabel = meta ? symbol : shortenAddress(transfer.token)

  const cast: Record<string, Actor> = {
    from: isMint
      ? { id: 'from', kind: 'router', label: 'Mint' }
      : { id: 'from', kind: 'eoa', label: shortenAddress(transfer.from), address: transfer.from },
    to: isBurn
      ? { id: 'to', kind: 'router', label: 'Burn' }
      : { id: 'to', kind: 'eoa', label: shortenAddress(transfer.to), address: transfer.to },
    token: { id: 'token', kind: 'token', label: tokenLabel, address: transfer.token },
    gas: { id: 'gas', kind: 'gas', label: 'Gas' },
  }

  const transferLine = isMint
    ? `${displayAmount} ${symbol} minted to ${shortenAddress(transfer.to)}`
    : isBurn
      ? `${displayAmount} ${symbol} burned`
      : `${displayAmount} ${symbol} leaves the wallet`

  const scenes: Story['scenes'] = [
    {
      type: 'opening',
      durationMs: DURATIONS.opening,
      caption: {
        line: isMint ? 'New tokens enter the world.' : 'A transaction enters the mempool.',
        sub: `Ethereum · block ${receipt.blockNumber.toLocaleString('en-US')}`,
      },
    },
    {
      type: 'transfer',
      durationMs: DURATIONS.transfer,
      from: 'from',
      to: 'to',
      asset: 'token',
      amount: transfer.value,
      visualMass: visualMassForToken(transfer.value, decimals),
      displayAmount,
      amountNumber,
      assumedDecimals,
      caption: {
        line: transferLine,
        sub: isMint
          ? `supply increased by ${displayAmount} ${symbol}`
          : isBurn
            ? 'sent to the zero address — gone forever'
            : `${shortenAddress(transfer.from)} → ${shortenAddress(transfer.to)}`,
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
    title: isMint ? `${symbol} Mint` : isBurn ? `${symbol} Burn` : `${symbol} Transfer`,
    synopsis: `${displayAmount} ${symbol} ${isMint ? 'minted' : isBurn ? 'burned' : `from ${shortenAddress(transfer.from)} to ${shortenAddress(transfer.to)}`}`,
    cast,
    scenes,
    facts: {
      from: transfer.from,
      to: transfer.to,
      value: 0n, // native ETH moved in this tx (token transfers move none)
      methodLabel: `ERC20 Transfer · ${tokenLabel}`,
      blockNumber: receipt.blockNumber,
      timestamp,
      gasUsed: receipt.gasUsed,
      effectiveGasPrice: receipt.effectiveGasPrice,
      gasCostEth,
    },
  }
}
