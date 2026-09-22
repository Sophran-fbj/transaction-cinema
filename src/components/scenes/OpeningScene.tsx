'use client'

import { motion, useTransform } from 'framer-motion'
import type { ReactNode } from 'react'
import type { StoryFacts } from '@/lib/story/types'
import { useSceneProgress } from '@/lib/player/sceneTimeline'
import { formatBlockTimestamp, shortenAddress } from '@/lib/utils/format'

function Reveal({
  delayMs = 0,
  durationMs,
  fromY = 0,
  className,
  children,
}: {
  delayMs?: number
  durationMs: number
  fromY?: number
  className: string
  children: ReactNode
}) {
  const opacity = useSceneProgress({ delayMs, durationMs, easing: 'easeOut' })
  const y = useTransform(opacity, (value) => fromY * (1 - value))

  return (
    <motion.div style={{ opacity, y }} className={className}>
      {children}
    </motion.div>
  )
}

export function OpeningScene({ facts, txHash }: { facts: StoryFacts; txHash: `0x${string}` }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-8">
      <Reveal
        durationMs={600}
        fromY={8}
        className="text-[11px] tracking-[0.45em] text-zinc-500 uppercase"
      >
        Now showing
      </Reveal>
      <Reveal
        delayMs={250}
        durationMs={800}
        className="font-mono text-xl text-zinc-100 sm:text-2xl"
      >
        {shortenAddress(txHash)}
      </Reveal>
      <Reveal delayMs={550} durationMs={800} className="text-sm text-zinc-500">
        Ethereum · Block {facts.blockNumber.toLocaleString('en-US')}
      </Reveal>
      <Reveal delayMs={800} durationMs={800} className="text-xs text-zinc-500">
        {formatBlockTimestamp(facts.timestamp)}
      </Reveal>
    </div>
  )
}
