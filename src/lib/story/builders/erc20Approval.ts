import { formatEther, formatGwei, formatUnits } from 'viem'
import type { Erc20ApprovalEvent } from '../../decode/events'
import type { TxBundle } from '../../fetch/types'
import { formatBlockTimestamp, shortenAddress } from '../../utils/format'
import type { Actor, Story } from '../types'

const MAX_UINT256 = 2n ** 256n - 1n

const DURATIONS = {
  opening: 2200,
  approval: 4400,
  gas: 2600,
  outro: 2800,
} as const

// One Approval event, three stories: grant a finite allowance, grant the
// infinite one (approve(spender, type(uint256).max) — the wallet-equivalent of
// handing over a signed blank check), or revoke by approving zero.
export function buildErc20ApprovalStory(
  bundle: TxBundle,
  { approval }: { approval: Erc20ApprovalEvent },
): Story {
  const { tx, receipt, blockTimestamp } = bundle
  const meta = bundle.tokenMeta[approval.token.toLowerCase()]

  const decimals = meta?.decimals ?? 18
  const assumedDecimals = !meta
  const symbol = meta?.symbol ?? 'TOKEN'
  const tokenLabel = meta ? symbol : shortenAddress(approval.token)

  const mode: 'limited' | 'unlimited' | 'revoke' =
    approval.value === MAX_UINT256
      ? 'unlimited'
      : approval.value === 0n
        ? 'revoke'
        : 'limited'

  // Unlimited is shown as ∞ — the raw uint256 is mathematically real but the
  // user's intent (and the practical meaning) is "no limit".
  const displayAmount = mode === 'unlimited' ? '∞' : formatUnits(approval.value, decimals)
  const amountNumber = mode === 'unlimited' ? undefined : Number(displayAmount)

  const gasCostEth = receipt.gasUsed * receipt.effectiveGasPrice
  const gwei = Number(formatGwei(receipt.effectiveGasPrice)).toLocaleString('en-US')
  const timestamp = Number(blockTimestamp)

  const cast: Record<string, Actor> = {
    owner: { id: 'owner', kind: 'eoa', label: shortenAddress(approval.owner), address: approval.owner },
    spender: { id: 'spender', kind: 'eoa', label: shortenAddress(approval.spender), address: approval.spender },
    token: { id: 'token', kind: 'token', label: tokenLabel, address: approval.token },
    gas: { id: 'gas', kind: 'gas', label: 'Gas' },
  }

  const approvalLine =
    mode === 'unlimited'
      ? 'Unlimited spending power is granted.'
      : mode === 'revoke'
        ? 'The spending power is taken back.'
        : `${displayAmount} ${symbol} of spending power is granted.`

  const approvalSub =
    mode === 'unlimited'
      ? `${symbol} · any amount, any time, until revoked`
      : mode === 'revoke'
        ? 'allowance set to zero — the vault is closed again'
        : `${shortenAddress(approval.owner)} → ${shortenAddress(approval.spender)} · allowances do not expire`

  const title =
    mode === 'unlimited'
      ? `${symbol} · Unlimited Approval`
      : mode === 'revoke'
        ? `${symbol} Allowance Revoked`
        : `${symbol} Approval`

  const synopsis =
    mode === 'unlimited'
      ? `${shortenAddress(approval.owner)} lets ${shortenAddress(approval.spender)} spend ${symbol} without limit.`
      : mode === 'revoke'
        ? `${shortenAddress(approval.owner)} cuts off ${shortenAddress(approval.spender)}.`
        : `${displayAmount} ${symbol} of allowance from ${shortenAddress(approval.owner)} to ${shortenAddress(approval.spender)}.`

  const scenes: Story['scenes'] = [
    {
      type: 'opening',
      durationMs: DURATIONS.opening,
      caption: {
        line: mode === 'revoke' ? 'A lock is about to close.' : 'A key is about to change hands.',
        sub: `Ethereum · block ${receipt.blockNumber.toLocaleString('en-US')}`,
      },
    },
    {
      type: 'approval',
      durationMs: DURATIONS.approval,
      owner: 'owner',
      spender: 'spender',
      token: 'token',
      mode,
      amount: approval.value,
      displayAmount,
      amountNumber,
      assumedDecimals,
      caption: {
        line: approvalLine,
        sub: approvalSub,
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
        line:
          mode === 'unlimited'
            ? 'Confirmed — the door stays open.'
            : mode === 'revoke'
              ? 'Confirmed — the allowance is zero again.'
              : 'Confirmed — the allowance is set.',
        sub: `Block ${receipt.blockNumber.toLocaleString('en-US')} · ${formatBlockTimestamp(timestamp)}`,
      },
    },
  ]

  return {
    txHash: tx.hash,
    chainLabel: 'Ethereum',
    status: 'success',
    title,
    synopsis,
    cast,
    scenes,
    facts: {
      from: approval.owner,
      to: approval.spender,
      value: 0n,
      methodLabel: `ERC20 Approval · ${tokenLabel}`,
      blockNumber: receipt.blockNumber,
      timestamp,
      gasUsed: receipt.gasUsed,
      effectiveGasPrice: receipt.effectiveGasPrice,
      gasCostEth,
    },
  }
}
