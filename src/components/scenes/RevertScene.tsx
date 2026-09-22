'use client'

import { motion, useTransform } from 'framer-motion'
import type { ReactNode } from 'react'
import type { Actor, Scene } from '@/lib/story/types'
import { CountUp } from '@/components/primitives/CountUp'
import { sampleKeyframes, useSceneProgress } from '@/lib/player/sceneTimeline'

function RevertFrame({ children }: { children: ReactNode }) {
  const progress = useSceneProgress({ durationMs: 1400, easing: 'easeIn' })
  const filter = useTransform(progress, (value) => `saturate(${1 - value * 0.65})`)
  return (
    <motion.div className="relative h-full w-full" style={{ filter }}>
      {children}
    </motion.div>
  )
}

function ShakingLayer({ children }: { children: ReactNode }) {
  const progress = useSceneProgress({ delayMs: 200, durationMs: 500 })
  const x = useTransform(progress, (value) =>
    sampleKeyframes([0, 0, -9, 9, -5, 3, 0], value, [0, 0.55, 0.65, 0.75, 0.85, 0.95, 1]),
  )
  return (
    <motion.div className="absolute inset-0" style={{ x }}>
      {children}
    </motion.div>
  )
}

function RewindParticle({ wave, delayMs }: { wave: number; delayMs: number }) {
  const progress = useSceneProgress({ delayMs, durationMs: 1600, easing: 'easeIn' })
  const up = wave - 16
  const left = useTransform(progress, (value) => `${sampleKeyframes([54, 45, 16], value)}%`)
  const top = useTransform(progress, (value) =>
    `calc(50% + ${sampleKeyframes([up, up, wave], value)}px)`,
  )
  const opacity = useTransform(progress, (value) => sampleKeyframes([0, 1, 0], value))
  return (
    <motion.div
      className="absolute size-2.5 rounded-full bg-zinc-400 shadow-[0_0_10px_2px_rgb(161_161_170_/_0.35)]"
      style={{ left, top, opacity }}
    />
  )
}

function RevertStamp() {
  const progress = useSceneProgress({ delayMs: 700, durationMs: 350, easing: 'easeOut' })
  const scale = useTransform(progress, (value) => 2.4 - value * 1.4)
  const rotate = useTransform(progress, (value) => -14 + value * 8)
  return (
    <motion.div
      style={{ opacity: progress, scale, rotate, boxShadow: '0 0 48px 12px rgb(239 68 68 / 0.25)' }}
      className="rounded-md border-4 border-red-500/80 px-5 py-2"
    >
      <span className="font-mono text-xl font-bold tracking-[0.2em] text-red-400 uppercase sm:text-2xl">
        Execution reverted
      </span>
    </motion.div>
  )
}

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
    <RevertFrame>
      {/* stage shake on impact */}
      <ShakingLayer>
        {/* rewind: particles retrace leftwards, desaturated */}
        {hasParticles &&
          particles.map((_, i) => {
            const wave = ((i % 5) - 2) * 14
            return (
              <RewindParticle
                key={i}
                wave={wave}
                delayMs={150 + (i / (scene.visualMass ?? 1)) * 800}
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
      </ShakingLayer>

      {/* the stamp */}
      <div className="absolute inset-0 flex items-center justify-center">
        <RevertStamp />
      </div>
    </RevertFrame>
  )
}
