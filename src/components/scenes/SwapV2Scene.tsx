'use client'

import { motion, useTransform } from 'framer-motion'
import type { CSSProperties, ReactNode } from 'react'
import type { Actor, Scene } from '@/lib/story/types'
import { ActorCard } from '@/components/actors/ActorCard'
import { actorHues, particleStyle } from '@/components/actors/actorVisual'
import { sampleKeyframes, useSceneProgress } from '@/lib/player/sceneTimeline'
import { usePrefersReducedMotion } from '@/lib/player/usePrefersReducedMotion'

function PoolShell({ beat, children }: { beat: number; children: ReactNode }) {
  const opacity = useSceneProgress({ durationMs: 500 * beat, easing: 'easeOut' })
  const scale = useTransform(opacity, (value) => 0.9 + value * 0.1)
  return (
    <motion.div
      style={{ opacity, scale }}
      className="relative flex h-40 w-40 items-end justify-center gap-2 rounded-[2rem] border border-white/15 bg-white/[0.04] p-5 shadow-[0_0_50px_rgb(251_191_36/0.08)] sm:h-48 sm:w-52"
    >
      {children}
    </motion.div>
  )
}

function SwapParticle({
  style,
  start,
  end,
  top,
  delayMs,
  durationMs,
}: {
  style: CSSProperties
  start: number
  end: number
  top: number
  delayMs: number
  durationMs: number
}) {
  const progress = useSceneProgress({ delayMs, durationMs, easing: 'easeInOut' })
  const left = useTransform(progress, (value) => `${start + (end - start) * value}%`)
  const opacity = useTransform(progress, (value) => sampleKeyframes([0, 1, 0], value))
  return (
    <motion.div
      className="absolute size-2 rounded-full"
      style={{ ...style, left, top: `${top}%`, opacity }}
    />
  )
}

function SwapReadout({ beat, children }: { beat: number; children: ReactNode }) {
  const opacity = useSceneProgress({ delayMs: 2800 * beat, durationMs: 500 * beat, easing: 'easeOut' })
  const y = useTransform(opacity, (value) => 8 * (1 - value))
  return (
    <motion.div style={{ opacity, y }} className="absolute inset-x-4 bottom-[7%] text-center">
      {children}
    </motion.div>
  )
}

export function SwapV2Scene({
  scene,
  cast,
}: {
  scene: Extract<Scene, { type: 'swapV2' }>
  cast: Record<string, Actor>
}) {
  const reducedMotion = usePrefersReducedMotion()
  const beat = reducedMotion ? 0.1 : 1
  const pair = cast[scene.pair]
  const tokenIn = cast[scene.tokenIn]
  const tokenOut = cast[scene.tokenOut]
  if (!pair || !tokenIn || !tokenOut) return null

  const inStyle = particleStyle(tokenIn)
  const outStyle = particleStyle(tokenOut)
  const inHue = actorHues(tokenIn).hue1
  const outHue = actorHues(tokenOut).hue1
  const particlesIn = Array.from({ length: Math.min(scene.visualMassIn, 12) })
  const particlesOut = Array.from({ length: Math.min(scene.visualMassOut, 12) })

  return (
    <div className="relative flex h-full items-center justify-between px-5 sm:px-12">
      <ActorCard actor={tokenIn} role="Token in" />
      <ActorCard actor={tokenOut} role="Token out" />

      <div className="absolute inset-x-[28%] top-[15%] bottom-[25%] flex flex-col items-center justify-center">
        <PoolShell beat={beat}>
          <ReserveTank
            label={tokenIn.label}
            display={scene.displayReserveIn}
            level={scene.reserveLevelIn}
            hue={inHue}
            beat={beat}
          />
          <div className="mb-10 shrink-0 font-mono text-xs text-amber-200/80">x × y = k</div>
          <ReserveTank
            label={tokenOut.label}
            display={scene.displayReserveOut}
            level={scene.reserveLevelOut}
            hue={outHue}
            beat={beat}
          />
          <div className="absolute -top-7 text-center">
            <div className="text-xs text-zinc-300">{scene.poolLabel}</div>
            {scene.feeLabel && <div className="text-[10px] text-zinc-500">{scene.feeLabel} fee</div>}
          </div>
        </PoolShell>
      </div>

      <div className="pointer-events-none absolute inset-0">
        {particlesIn.map((_, i) => (
          <SwapParticle
            key={`in-${i}`}
            style={inStyle}
            start={15}
            end={43}
            top={42 + (i % 4) * 4}
            durationMs={1600 * beat}
            delayMs={(200 + i * 60) * beat}
          />
        ))}
        {particlesOut.map((_, i) => (
          <SwapParticle
            key={`out-${i}`}
            style={outStyle}
            start={57}
            end={85}
            top={42 + (i % 4) * 4}
            durationMs={1600 * beat}
            delayMs={(1600 + i * 60) * beat}
          />
        ))}
      </div>

      <SwapReadout beat={beat}>
        <div className="font-mono text-sm text-zinc-100 sm:text-base">
          {scene.displayIn} {tokenIn.label} → {scene.displayOut} {tokenOut.label}
        </div>
        <div className="mt-1 text-[10px] text-zinc-500 sm:text-xs">
          {scene.priceLabel ?? 'Reserves rebalanced'}
          {scene.assumedDecimals ? ' · 18 decimals assumed' : ''}
        </div>
      </SwapReadout>
    </div>
  )
}

function ReserveTank({
  label,
  display,
  level,
  hue,
  beat,
}: {
  label: string
  display: string
  level: number
  hue: number
  beat: number
}) {
  const progress = useSceneProgress({
    delayMs: 800 * beat,
    durationMs: 1500 * beat,
    easing: 'easeInOut',
  })
  const height = useTransform(progress, (value) => `${20 + (level * 100 - 20) * value}%`)

  return (
    <div className="relative h-28 w-10 overflow-hidden rounded-b-xl border border-white/10 bg-black/50 sm:h-32 sm:w-12">
      <motion.div
        className="absolute inset-x-0 bottom-0"
        style={{
          height,
          background: `linear-gradient(to top, hsl(${hue} 70% 38%), hsl(${hue} 75% 62%))`,
        }}
      />
      <div className="absolute inset-x-0 bottom-1 truncate px-0.5 text-center font-mono text-[8px] text-white/80">
        {label}
      </div>
      <div className="sr-only">Reserve {display} {label}</div>
    </div>
  )
}
