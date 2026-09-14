import { formatEther, type Address } from 'viem'
import type { TxBundle } from '../../fetch/types'
import { shortenAddress } from '../../utils/format'
import { calldataSelector } from '../../utils/selector'
import type { Actor, Story } from '../types'

// The designed fallback. Missing ABI decode is a first-class state, not an
// error: we show the 4-byte selector and honest copy instead of pretending
// to understand the calldata. (A real revert story — intent + rewind — is a
// later stage; until then reverted txs land here with honest copy.)
export function buildUnknownStory(bundle: TxBundle): Story {
  const { tx, receipt, blockTimestamp } = bundle
  const reverted = receipt.status === 'reverted'
  const selector = calldataSelector(tx.input)
  const gasCostEth = receipt.gasUsed * receipt.effectiveGasPrice
  const timestamp = Number(blockTimestamp)

  const cast: Record<string, Actor> = {
    from: { id: 'from', kind: 'eoa', label: shortenAddress(tx.from), address: tx.from as Address },
    to: tx.to
      ? { id: 'to', kind: 'eoa', label: shortenAddress(tx.to), address: tx.to }
      : { id: 'to', kind: 'router', label: 'Contract Creation' },
    gas: { id: 'gas', kind: 'gas', label: 'Gas' },
  }

  const scenes: Story['scenes'] = [
    {
      type: 'opening',
      durationMs: 2200,
      caption: {
        line: reverted ? 'A transaction was attempted.' : 'A transaction enters the mempool.',
        sub: `Ethereum · block ${receipt.blockNumber.toLocaleString('en-US')}`,
      },
    },
    {
      type: 'gas',
      durationMs: 2600,
      gasUsed: receipt.gasUsed,
      effectiveGasPrice: receipt.effectiveGasPrice,
      costEth: gasCostEth,
      caption: reverted
        ? { line: 'Execution reverted.', sub: 'Nothing changed onchain. Except the gas.' }
        : {
            line: 'The Gas Void takes its share.',
            sub: `${formatEther(gasCostEth)} ETH paid for an unscripted performance`,
          },
    },
    {
      type: 'outro',
      durationMs: 2800,
      caption: reverted
        ? { line: 'Execution reverted.', sub: 'Nothing changed onchain. Except the gas.' }
        : {
            line: 'This story is not scripted yet.',
            sub: selector ? `Unknown call · selector ${selector}` : 'No calldata, no logs, no story',
          },
    },
  ]

  return {
    txHash: tx.hash,
    chainLabel: 'Ethereum',
    status: reverted ? 'reverted' : 'success',
    title: reverted ? 'Failed Transaction' : 'Unknown Transaction',
    synopsis: reverted
      ? 'Execution reverted — gas paid, nothing changed.'
      : selector
        ? `Unknown call · selector ${selector}`
        : 'An unscripted performance',
    cast,
    scenes,
    facts: {
      from: tx.from as Address,
      to: tx.to,
      value: tx.value,
      methodLabel: selector ? `Unknown call ${selector}` : 'Unknown',
      blockNumber: receipt.blockNumber,
      timestamp,
      gasUsed: receipt.gasUsed,
      effectiveGasPrice: receipt.effectiveGasPrice,
      gasCostEth,
    },
  }
}
