import { formatEther, formatGwei, type Address } from 'viem'
import type { TxBundle } from '../../fetch/types'
import { formatBlockTimestamp, shortenAddress } from '../../utils/format'
import { visualMassForEth } from '../semantics'
import type { Actor, Story } from '../types'
import { buildUnknownStory } from './unknown'

const DURATIONS = {
  opening: 2200,
  transfer: 3600,
  gas: 2600,
  outro: 2800,
} as const

export function buildNativeTransferStory(bundle: TxBundle): Story {
  const { tx, receipt, blockTimestamp } = bundle
  // Plain value moves only reach this builder when `to` exists — contract
  // creation carries bytecode in calldata and classifies as unknown.
  if (tx.to === null) return buildUnknownStory(bundle)

  const from = tx.from as Address
  const to = tx.to
  const valueEth = formatEther(tx.value)
  const zeroValue = tx.value === 0n
  const gasCostEth = receipt.gasUsed * receipt.effectiveGasPrice
  const gwei = Number(formatGwei(receipt.effectiveGasPrice)).toLocaleString('en-US')
  const timestamp = Number(blockTimestamp)

  const cast: Record<string, Actor> = {
    from: { id: 'from', kind: 'eoa', label: shortenAddress(from), address: from },
    to: { id: 'to', kind: 'eoa', label: shortenAddress(to), address: to },
    eth: { id: 'eth', kind: 'native', label: 'ETH' },
    gas: { id: 'gas', kind: 'gas', label: 'Gas' },
  }

  const scenes: Story['scenes'] = [
    {
      type: 'opening',
      durationMs: DURATIONS.opening,
      caption: {
        line: 'A transaction enters the mempool.',
        sub: `Ethereum · block ${receipt.blockNumber.toLocaleString('en-US')}`,
      },
    },
    {
      type: 'transfer',
      durationMs: DURATIONS.transfer,
      from: 'from',
      to: 'to',
      asset: 'eth',
      amount: tx.value,
      visualMass: visualMassForEth(tx.value),
      caption: zeroValue
        ? { line: 'Nothing was sent.', sub: 'Zero value — only gas will move' }
        : {
            line: `${valueEth} ETH leaves the wallet`,
            sub: `${shortenAddress(from)} → ${shortenAddress(to)}`,
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
      caption: zeroValue
        ? { line: 'Confirmed — a transaction that did nothing.', sub: 'Only the gas was real' }
        : {
            line: 'Confirmed onchain.',
            sub: `Block ${receipt.blockNumber.toLocaleString('en-US')} · ${formatBlockTimestamp(timestamp)}`,
          },
    },
  ]

  return {
    txHash: tx.hash,
    chainLabel: 'Ethereum',
    status: 'success',
    title: 'ETH Transfer',
    synopsis: zeroValue
      ? 'Sent nothing, paid gas.'
      : `${valueEth} ETH from ${shortenAddress(from)} to ${shortenAddress(to)}`,
    cast,
    scenes,
    facts: {
      from,
      to,
      value: tx.value,
      methodLabel: 'ETH Transfer',
      blockNumber: receipt.blockNumber,
      timestamp,
      gasUsed: receipt.gasUsed,
      effectiveGasPrice: receipt.effectiveGasPrice,
      gasCostEth,
    },
  }
}
