'use client'

import { motion } from 'framer-motion'
import { useState, type ReactNode } from 'react'
import { formatEther, formatGwei } from 'viem'
import type { StoryFacts } from '@/lib/story/types'
import { formatBlockTimestamp, shortenAddress } from '@/lib/utils/format'

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6 py-2">
      <span className="shrink-0 text-[10px] tracking-[0.2em] text-zinc-500 uppercase">{label}</span>
      <span className="text-right font-mono text-sm text-zinc-200">{children}</span>
    </div>
  )
}

const BUTTON =
  'rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-white/10'

// The receipt card — stage-1 plain version. The cinema-ticket treatment
// (perforation, printed ticket number) is a later polish pass.
export function OutroScene({
  facts,
  status,
  txHash,
  onReplay,
}: {
  facts: StoryFacts
  status: 'success' | 'reverted'
  txHash: `0x${string}`
  onReplay: () => void
}) {
  const [copied, setCopied] = useState(false)

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      // clipboard unavailable — ignore
    }
  }

  const gwei = Number(formatGwei(facts.effectiveGasPrice)).toLocaleString('en-US')

  return (
    <div className="flex h-full flex-col items-center justify-center px-6 py-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md rounded-xl border border-white/10 bg-zinc-900/70 p-5 sm:p-6"
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[10px] tracking-[0.3em] text-zinc-500 uppercase">receipt</span>
          <span
            className={`rounded-full border px-2.5 py-0.5 text-[10px] tracking-widest uppercase ${
              status === 'success'
                ? 'border-amber-400/30 bg-amber-400/10 text-amber-300'
                : 'border-red-400/30 bg-red-400/10 text-red-300'
            }`}
          >
            {status}
          </span>
        </div>

        <div className="divide-y divide-white/5">
          <Row label="From">{shortenAddress(facts.from)}</Row>
          <Row label="To">{facts.to ? shortenAddress(facts.to) : 'contract creation'}</Row>
          <Row label="Value">{formatEther(facts.value)} ETH</Row>
          <Row label="Gas">
            {facts.gasUsed.toLocaleString('en-US')} · {gwei} gwei = {formatEther(facts.gasCostEth)} ETH
          </Row>
          <Row label="Block">{facts.blockNumber.toLocaleString('en-US')}</Row>
          <Row label="Time">{formatBlockTimestamp(facts.timestamp)}</Row>
          <Row label="Hash">
            <span className="text-xs break-all">{txHash}</span>
          </Row>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button type="button" onClick={onReplay} className={BUTTON}>
            Replay
          </button>
          <button type="button" onClick={copyLink} className={BUTTON}>
            {copied ? 'Copied' : 'Copy link'}
          </button>
          <a
            href={`https://etherscan.io/tx/${txHash}`}
            target="_blank"
            rel="noreferrer"
            className={BUTTON}
          >
            Etherscan ↗
          </a>
        </div>
      </motion.div>
    </div>
  )
}
