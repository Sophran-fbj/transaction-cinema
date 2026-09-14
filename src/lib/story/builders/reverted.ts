import { formatEther, formatGwei, formatUnits, type Address } from 'viem'
import type { DecodedIntent } from '../../decode/intent'
import type { TxBundle } from '../../fetch/types'
import { formatBlockTimestamp, shortenAddress } from '../../utils/format'
import { visualMassForEth, visualMassForToken } from '../semantics'
import type { Actor, Scene, Story } from '../types'

const MAX_UINT256 = 2n ** 256n - 1n

const DURATIONS = {
  opening: 2200,
  intentTransfer: 3400,
  intentApproval: 4400,
  revert: 3200,
  gas: 2600,
  outro: 3000,
} as const

// The failed-tx film: what the tx ATTEMPTED (calldata intent — a revert
// discards every event, so this is the only source), the world saying no
// (rewind + stamp), and the one line every failed tx shares: nothing changed
// onchain, except the gas.
export function buildRevertedStory(
  bundle: TxBundle,
  { intent, selector }: { intent: DecodedIntent; selector: `0x${string}` | null },
): Story {
  const { tx, receipt, blockTimestamp } = bundle
  const from = tx.from as Address
  const gasCostEth = receipt.gasUsed * receipt.effectiveGasPrice
  const gwei = Number(formatGwei(receipt.effectiveGasPrice)).toLocaleString('en-US')
  const timestamp = Number(blockTimestamp)

  const cast: Record<string, Actor> = {
    from: { id: 'from', kind: 'eoa', label: shortenAddress(from), address: from },
    gas: { id: 'gas', kind: 'gas', label: 'Gas' },
  }

  const scenes: Scene[] = [
    {
      type: 'opening',
      durationMs: DURATIONS.opening,
      caption: {
        line: 'A transaction is attempted.',
        sub: `Ethereum · block ${receipt.blockNumber.toLocaleString('en-US')}`,
      },
    },
  ]

  let title = 'Failed Transaction'
  let synopsis = selector ? `An unknown call (${selector}) was rejected.` : 'The chain said no.'
  let rewind: Partial<Extract<Scene, { type: 'revert' }>> = {}

  if (intent.type === 'nativeTransfer') {
    cast.to = { id: 'to', kind: 'eoa', label: shortenAddress(intent.to), address: intent.to }
    cast.eth = { id: 'eth', kind: 'native', label: 'ETH' }
    scenes.push({
      type: 'transfer',
      durationMs: DURATIONS.intentTransfer,
      from: 'from',
      to: 'to',
      asset: 'eth',
      amount: intent.value,
      visualMass: visualMassForEth(intent.value),
      interrupted: true,
      caption: {
        line: `${formatEther(intent.value)} ETH tries to leave the wallet.`,
        sub: `${shortenAddress(from)} → ${shortenAddress(intent.to)} — attempted`,
      },
    })
    rewind = { from: 'from', to: 'to', asset: 'eth', amount: intent.value, visualMass: visualMassForEth(intent.value) }
    title = 'Failed ETH Transfer'
    synopsis = `Tried to send ${formatEther(intent.value)} ETH. The chain said no.`
  } else if (intent.type === 'erc20Transfer') {
    const meta = bundle.tokenMeta[intent.token.toLowerCase()]
    const decimals = meta?.decimals ?? 18
    const symbol = meta?.symbol ?? 'TOKEN'
    const displayAmount = formatUnits(intent.value, decimals)
    cast.to = { id: 'to', kind: 'eoa', label: shortenAddress(intent.to), address: intent.to }
    cast.token = { id: 'token', kind: 'token', label: meta ? symbol : shortenAddress(intent.token), address: intent.token }
    scenes.push({
      type: 'transfer',
      durationMs: DURATIONS.intentTransfer,
      from: 'from',
      to: 'to',
      asset: 'token',
      amount: intent.value,
      visualMass: visualMassForToken(intent.value, decimals),
      displayAmount,
      amountNumber: Number(displayAmount),
      assumedDecimals: !meta,
      interrupted: true,
      caption: {
        line: `${displayAmount} ${symbol} tries to reach the recipient.`,
        sub: 'attempted — the balance will not move',
      },
    })
    rewind = { from: 'from', to: 'to', asset: 'token', amount: intent.value, visualMass: visualMassForToken(intent.value, decimals), displayAmount, amountNumber: Number(displayAmount) }
    title = `Failed ${symbol} Transfer`
    synopsis = `Tried to send ${displayAmount} ${symbol}. The chain said no.`
  } else if (intent.type === 'erc20Approve') {
    const meta = bundle.tokenMeta[intent.token.toLowerCase()]
    const decimals = meta?.decimals ?? 18
    const symbol = meta?.symbol ?? 'TOKEN'
    const mode = intent.value === MAX_UINT256 ? 'unlimited' : intent.value === 0n ? 'revoke' : 'limited'
    const displayAmount = mode === 'unlimited' ? '∞' : formatUnits(intent.value, decimals)
    cast.spender = { id: 'spender', kind: 'eoa', label: shortenAddress(intent.spender), address: intent.spender }
    cast.token = { id: 'token', kind: 'token', label: meta ? symbol : shortenAddress(intent.token), address: intent.token }
    scenes.push({
      type: 'approval',
      durationMs: DURATIONS.intentApproval,
      owner: 'from',
      spender: 'spender',
      token: 'token',
      mode,
      amount: intent.value,
      displayAmount,
      amountNumber: mode === 'unlimited' ? undefined : Number(displayAmount),
      assumedDecimals: !meta,
      attempted: true,
      caption: {
        line:
          mode === 'unlimited'
            ? 'Unlimited spending power is offered.'
            : mode === 'revoke'
              ? 'The spending power is offered back.'
              : `${displayAmount} ${symbol} of spending power is offered.`,
        sub: 'attempted — the allowance will not change',
      },
    })
    title = `Failed ${symbol} Approval`
    synopsis = `Tried to grant ${displayAmount === '∞' ? 'unlimited' : displayAmount} ${symbol} of allowance. The chain said no.`
  }

  // the rewind: nothing survives except the gas
  scenes.push({
    type: 'revert',
    durationMs: DURATIONS.revert,
    caption: {
      line: 'Execution reverted.',
      sub: 'everything returns to where it was',
    },
    ...rewind,
  })

  scenes.push({
    type: 'gas',
    durationMs: DURATIONS.gas,
    gasUsed: receipt.gasUsed,
    effectiveGasPrice: receipt.effectiveGasPrice,
    costEth: gasCostEth,
    caption: {
      line: 'Even failure has a price.',
      sub: `${formatEther(gasCostEth)} ETH · ${gwei} gwei × ${receipt.gasUsed.toLocaleString('en-US')} units — paid in full`,
    },
  })

  scenes.push({
    type: 'outro',
    durationMs: DURATIONS.outro,
    caption: {
      line: 'Nothing changed onchain. Except the gas.',
      sub: `Block ${receipt.blockNumber.toLocaleString('en-US')} · ${formatBlockTimestamp(timestamp)}`,
    },
  })

  return {
    txHash: tx.hash,
    chainLabel: 'Ethereum',
    status: 'reverted',
    title,
    synopsis,
    cast,
    scenes,
    facts: {
      from,
      to: tx.to,
      value: tx.value,
      methodLabel: `Failed · ${selector ?? 'no calldata'}`,
      blockNumber: receipt.blockNumber,
      timestamp,
      gasUsed: receipt.gasUsed,
      effectiveGasPrice: receipt.effectiveGasPrice,
      gasCostEth,
    },
  }
}
