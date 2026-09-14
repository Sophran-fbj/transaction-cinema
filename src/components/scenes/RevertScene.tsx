'use client'

import { motion } from 'framer-motion'
import type { Actor, Scene } from '@/lib/story/types'
import { CountUp } from '@/components/primitives/CountUp'

// The signature moment: time runs backwards. Particles retrace their path in
// grey (color drains as the world rejects the tx), the amount ticks back to
// zero, and a REVERTED stamp slams down with a stage shake. Whatever the
// intent was, nothing survives — except the gas, in the next scene.
export function RevertScene({
  scene,
  cast,
}: {
  scene: Extract<Scene, { type: 'revert' }>
  cast: Record<string, Actor>
}) {
  const hasParticles =
    scene.from !== undefined && scene.to !== undefined && scene.asset !== undefined && scene.visualMass !== undefined
  const asset = scene.asset ? cast[scene.asset] : undefined
  const decimals = scene.displayAmount?.split('.')[1]?.length ?? 0
  const unit = asset?.label ?? ''

  const particles = Array.from({ length: scene.visualMass ?? 0 })

  return (
    <motion.div
      className="relative h-full w-full"
      initial={{ filter: 'saturate(1)' }}
      animate={{ filter: 'saturate(0.35)' }}
      transition={{ duration: 1.4, ease: 'easeIn' }}
    >
      {/* stage shake on impact */}
      <motion.div
        className="absolute inset-0"
        animate={{ x: [0, 0, -9, 9, -5, 3, 0] }}
        transition={{ duration: 0.5, times: [0, 0.55, 0.65, 0.75, 0.85, 0.95, 1], delay: 0.2 }}
      >
        {/* rewind: particles retrace leftwards, desaturated */}
        {hasParticles &&
          particles.map((_, i) => {
            const wave = ((i % 5) - 2) * 14
            const up = wave - 16
            return (
              <motion.div
                key={i}
                className="absolute size-2.5 rounded-full bg-zinc-400 shadow-[0_0_10px_2px_rgb(161_161_170_/_0.35)]"
                initial={{ left: '54%', top: `calc(50% + ${up}px)`, opacity: 0 }}
                animate={{
                  left: ['54%', '45%', '16%'],
                  top: [
                    `calc(50% + ${up}px)`,
                    `calc(50% + ${up}px)`,
                    `calc(50% + ${wave}px)`,
                  ],
                  opacity: [0, 1, 0],
                }}
                transition={{
                  duration: 1.6,
                  delay: 0.15 + (i / (scene.visualMass ?? 1)) * 0.8,
                  ease: 'easeIn',
                }}
              />
            )
          })}

        {/* the amount ticks back to where it started: zero */}
        {hasParticles && scene.amountNumber !== undefined && (
          <div className="absolute bottom-[16%] left-1/2 -translate-x-1/2 text-center">
            <CountUp
              from={scene.amountNumber}
              value={0}
              format={(v) => `${v.toFixed(decimals)} ${unit}`}
              durationMs={1900}
              className="font-mono text-2xl text-zinc-400 tabular-nums"
            />
            <div className="mt-1 text-[11px] text-zinc-600">as if it never happened</div>
          </div>
        )}
      </motion.div>

      {/* the stamp */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 2.4, rotate: -14 }}
          animate={{ opacity: 1, scale: 1, rotate: -6 }}
          transition={{ duration: 0.35, delay: 0.7, ease: [0.16, 1.2, 0.3, 1] }}
          className="rounded-md border-4 border-red-500/80 px-5 py-2"
          style={{ boxShadow: '0 0 48px 12px rgb(239 68 68 / 0.25)' }}
        >
          <span className="font-mono text-xl font-bold tracking-[0.2em] text-red-400 uppercase sm:text-2xl">
            Execution reverted
          </span>
        </motion.div>
      </div>
    </motion.div>
  )
}
