'use client'

import { motion } from 'framer-motion'
import type { StoryFacts } from '@/lib/story/types'
import { formatBlockTimestamp, shortenAddress } from '@/lib/utils/format'

export function OpeningScene({ facts, txHash }: { facts: StoryFacts; txHash: `0x${string}` }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-8">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-[11px] tracking-[0.45em] text-zinc-500 uppercase"
      >
        Now showing
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.25 }}
        className="font-mono text-xl text-zinc-100 sm:text-2xl"
      >
        {shortenAddress(txHash)}
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.55 }}
        className="text-sm text-zinc-500"
      >
        Ethereum · Block {facts.blockNumber.toLocaleString('en-US')}
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.8 }}
        className="text-xs text-zinc-500"
      >
        {formatBlockTimestamp(facts.timestamp)}
      </motion.div>
    </div>
  )
}
