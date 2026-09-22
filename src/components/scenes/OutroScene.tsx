'use client'

import { motion, useTransform } from 'framer-motion'
import { useState, type ReactNode } from 'react'
import { formatEther, formatGwei } from 'viem'
import type { StoryFacts } from '@/lib/story/types'
import { useSceneProgress } from '@/lib/player/sceneTimeline'
import { formatBlockTimestamp, shortenAddress } from '@/lib/utils/format'

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6 py-1.5 sm:py-2">
      <span className="shrink-0 text-[10px] tracking-[0.2em] text-zinc-500 uppercase">{label}</span>
      <span className="text-right font-mono text-[13px] text-zinc-200 sm:text-sm">{children}</span>
    </div>
  )
}

const BUTTON =
  'rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-white/10'

function TicketReveal({ children }: { children: ReactNode }) {
  const opacity = useSceneProgress({ durationMs: 500, easing: 'easeOut' })
  const y = useTransform(opacity, (value) => 12 * (1 - value))
  return (
    <motion.div style={{ opacity, y }} className="flex w-full max-w-md items-stretch">
      {children}
    </motion.div>
  )
}

// The ending: the whole film prints itself into an admission ticket — a body
// of receipt rows and a stub torn along the perforation. Every value on the
// ticket is real chain data; the ticket shape is the only theatre.
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
    // Small screens run the ticket vertically: the perforation and stub are
    // hidden (the stub carries no unique data) and rows compress, so all
    // seven receipt rows fit the mobile stage instead of being clipped.
    <div className="flex h-full flex-col items-center justify-center px-4 py-4 sm:px-6 sm:py-5">
      <TicketReveal>
        {/* ticket body */}
        <div className="flex-1 rounded-xl border border-white/10 bg-zinc-900/70 p-4 sm:rounded-l-xl sm:rounded-r-none sm:border-r-0 sm:p-6">
          <div className="mb-2 flex items-center justify-between sm:mb-3">
            <span className="text-[10px] tracking-[0.3em] text-zinc-500 uppercase">
              transaction cinema
            </span>
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
              {facts.gasUsed.toLocaleString('en-US')} · {gwei} gwei ={' '}
              {formatEther(facts.gasCostEth)} ETH
            </Row>
            <Row label="Block">{facts.blockNumber.toLocaleString('en-US')}</Row>
            <Row label="Time">{formatBlockTimestamp(facts.timestamp)}</Row>
            <Row label="Hash">
              {/* full hash on wide tickets, shortened where it must fit one line */}
              <span className="sm:hidden">{shortenAddress(txHash)}</span>
              <span className="hidden text-left text-[11px] break-all sm:inline">{txHash}</span>
            </Row>
          </div>
        </div>

        {/* perforation: dashed line with punched semicircles top and bottom */}
        <div className="relative hidden w-0 border-l border-dashed border-white/20 sm:block">
          <div className="absolute top-0 -left-[9px] size-[18px] rounded-full bg-black" />
          <div className="absolute bottom-0 -left-[9px] size-[18px] rounded-full bg-black" />
        </div>

        {/* ticket stub — decorative on wide screens only */}
        <div className="hidden w-24 flex-col items-center justify-center gap-8 rounded-r-xl border border-l-0 border-white/10 bg-zinc-900 py-4 sm:flex sm:w-28">
          <span className="text-[9px] tracking-[0.3em] text-amber-200/80 uppercase [writing-mode:vertical-rl]">
            admit one
          </span>
          <div className="flex flex-col items-center gap-1">
            <span className="text-[9px] tracking-[0.25em] text-zinc-500 uppercase">ticket no.</span>
            <span className="font-mono text-xs text-zinc-400">{txHash.slice(-6)}</span>
            <span className="font-mono text-[10px] text-zinc-500">
              blk {facts.blockNumber.toString().slice(-6)}
            </span>
          </div>
        </div>
      </TicketReveal>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:mt-5">
        <button type="button" onClick={onReplay} className={BUTTON}>
          Replay
        </button>
        <button type="button" onClick={copyLink} className={BUTTON} aria-live="polite">
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
    </div>
  )
}
