'use client'

import { motion } from 'framer-motion'
import type { Actor, Scene } from '@/lib/story/types'
import { ActorCard } from '@/components/actors/ActorCard'
import { actorHues, particleStyle } from '@/components/actors/actorVisual'
import { usePrefersReducedMotion } from '@/lib/player/usePrefersReducedMotion'

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
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 * beat }}
          className="relative flex h-40 w-40 items-end justify-center gap-2 rounded-[2rem] border border-white/15 bg-white/[0.04] p-5 shadow-[0_0_50px_rgb(251_191_36/0.08)] sm:h-48 sm:w-52"
        >
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
        </motion.div>
      </div>

      <div className="pointer-events-none absolute inset-0">
        {particlesIn.map((_, i) => (
          <motion.div
            key={`in-${i}`}
            className="absolute size-2 rounded-full"
            style={inStyle}
            initial={{ left: '15%', top: `${42 + (i % 4) * 4}%`, opacity: 0 }}
            animate={{ left: '43%', opacity: [0, 1, 0] }}
            transition={{ duration: 1.6 * beat, delay: (0.2 + i * 0.06) * beat }}
          />
        ))}
        {particlesOut.map((_, i) => (
          <motion.div
            key={`out-${i}`}
            className="absolute size-2 rounded-full"
            style={outStyle}
            initial={{ left: '57%', top: `${42 + (i % 4) * 4}%`, opacity: 0 }}
            animate={{ left: '85%', opacity: [0, 1, 0] }}
            transition={{ duration: 1.6 * beat, delay: (1.6 + i * 0.06) * beat }}
          />
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2.8 * beat, duration: 0.5 * beat }}
        className="absolute inset-x-4 bottom-[7%] text-center"
      >
        <div className="font-mono text-sm text-zinc-100 sm:text-base">
          {scene.displayIn} {tokenIn.label} → {scene.displayOut} {tokenOut.label}
        </div>
        <div className="mt-1 text-[10px] text-zinc-500 sm:text-xs">
          {scene.priceLabel ?? 'Reserves rebalanced'}
          {scene.assumedDecimals ? ' · 18 decimals assumed' : ''}
        </div>
      </motion.div>
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
  return (
    <div className="relative h-28 w-10 overflow-hidden rounded-b-xl border border-white/10 bg-black/50 sm:h-32 sm:w-12">
      <motion.div
        className="absolute inset-x-0 bottom-0"
        style={{ background: `linear-gradient(to top, hsl(${hue} 70% 38%), hsl(${hue} 75% 62%))` }}
        initial={{ height: '20%' }}
        animate={{ height: `${level * 100}%` }}
        transition={{ delay: 0.8 * beat, duration: 1.5 * beat, ease: 'easeInOut' }}
      />
      <div className="absolute inset-x-0 bottom-1 truncate px-0.5 text-center font-mono text-[8px] text-white/80">
        {label}
      </div>
      <div className="sr-only">Reserve {display} {label}</div>
    </div>
  )
}
