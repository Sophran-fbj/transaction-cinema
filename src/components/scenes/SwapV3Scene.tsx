'use client'

import { motion } from 'framer-motion'
import { useMemo } from 'react'
import type { Actor, Scene } from '@/lib/story/types'
import { ActorCard } from '@/components/actors/ActorCard'
import { actorHues } from '@/components/actors/actorVisual'
import { CountUp } from '@/components/primitives/CountUp'
import { liquidityGlow } from '@/lib/story/semantics'

// The V3 flagship: a liquidity tunnel. In-particles (tokenIn's color) fly
// from the trader into the corridor, the price needle sweeps and settles on
// the REAL terminal tick, and out-particles exit in tokenOut's color. The
// corridor's glow is real active liquidity; the needle's path is stylized —
// only its destination is data.

function particleGlow(actor: Actor | undefined) {
  const { hue1 } = actorHues(actor)
  const isNative = actor?.kind === 'native'
  return {
    background: isNative ? 'hsl(48 96% 68%)' : `hsl(${hue1} 70% 62%)`,
    boxShadow: `0 0 10px 2px ${isNative ? 'rgb(252 211 77 / 0.4)' : `hsl(${hue1} 70% 62% / 0.4)`}`,
  }
}

export function SwapV3Scene({
  scene,
  cast,
}: {
  scene: Extract<Scene, { type: 'swapV3' }>
  cast: Record<string, Actor>
}) {
  const user = cast.user
  const pool = cast.pool
  const tokenIn = cast[scene.tokenIn]
  const tokenOut = cast[scene.tokenOut]

  const glowIn = useMemo(() => particleGlow(tokenIn), [tokenIn])
  const glowOut = useMemo(() => particleGlow(tokenOut), [tokenOut])
  const liquidity = useMemo(() => liquidityGlow(scene.activeLiquidity), [scene.activeLiquidity])

  if (!user || !pool || !tokenIn || !tokenOut) return null

  const inParticles = Array.from({ length: scene.visualMassIn })
  const outParticles = Array.from({ length: scene.visualMassOut })

  const inDecimals = scene.displayIn?.split('.')[1]?.length ?? 0
  const outDecimals = scene.displayOut?.split('.')[1]?.length ?? 0
  const unitsIn = Number(scene.displayIn)
  const unitsOut = Number(scene.displayOut)

  const { hue1: hueIn } = actorHues(tokenIn)
  const { hue1: hueOut } = actorHues(tokenOut)

  return (
    <div className="relative flex h-full items-center px-8 sm:px-12">
      <ActorCard actor={user} role="Trader" />

      {/* the tunnel */}
      <div className="relative mx-auto w-[46%]">
        {/* pool badge */}
        <div className="absolute -top-9 left-1/2 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap">
          <span className="text-[10px] tracking-[0.25em] text-zinc-500 uppercase">
            {scene.poolLabel}
          </span>
          {scene.feeLabel && (
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-zinc-400">
              {scene.feeLabel}
            </span>
          )}
        </div>

        <div
          className="relative h-36 overflow-hidden rounded-2xl border sm:h-44"
          style={{
            borderColor: `hsl(${hueIn} 70% 62% / 0.35)`,
            background: 'rgb(9 9 11 / 0.9)',
            boxShadow: `inset 0 0 40px 8px hsl(${hueIn} 70% 62% / 0.06)`,
          }}
        >
          {/* tick scale — abstract ruler, only the terminal position is real */}
          <div className="absolute inset-x-3 top-3 flex justify-between">
            {Array.from({ length: 13 }).map((_, i) => (
              <div
                key={i}
                className={`w-px ${i === 10 ? 'h-3.5 bg-amber-300/80' : 'h-2 bg-white/15'}`}
              />
            ))}
          </div>

          {/* liquidity corridor — glow intensity is real active liquidity */}
          <motion.div
            className="absolute inset-x-0 top-[38%] h-[30%]"
            style={{
              background: `linear-gradient(90deg, hsl(${hueIn} 70% 62% / ${liquidity * 0.5}), hsl(${hueOut} 70% 62% / ${liquidity * 0.5}))`,
              filter: `blur(${14 - liquidity * 8}px)`,
            }}
            initial={{ opacity: 0, scaleY: 0.6 }}
            animate={{ opacity: 1, scaleY: 1 }}
            transition={{ duration: 1.2, delay: 0.3 }}
          />

          {/* in-particles streaming through the corridor */}
          <div className="absolute inset-0">
            {inParticles.map((_, i) => (
              <motion.div
                key={i}
                className="absolute top-1/2 size-2 rounded-full"
                style={glowIn}
                initial={{ left: '2%', opacity: 0 }}
                animate={{ left: ['2%', '50%', '96%'], opacity: [0, 1, 0.9] }}
                transition={{
                  duration: 1.5,
                  delay: 0.25 + (i / scene.visualMassIn) * 1.2,
                  ease: 'easeIn',
                }}
              />
            ))}
          </div>

          {/* the price needle — stylized path, real destination */}
          <motion.div
            className="absolute top-0 bottom-0 w-px bg-amber-300"
            initial={{ left: '12%', opacity: 0 }}
            animate={{ left: '76%', opacity: [0, 1, 1] }}
            transition={{ duration: 2.2, delay: 1.1, ease: [0.4, 0, 0.2, 1] }}
            style={{ boxShadow: '0 0 12px 2px rgb(252 211 77 / 0.5)' }}
          >
            <span className="absolute top-2 left-1.5 rounded bg-amber-300/15 px-1 font-mono text-[9px] whitespace-nowrap text-amber-200">
              tick {scene.endTick.toLocaleString('en-US')}
            </span>
          </motion.div>

          {/* out-particles exiting */}
          <div className="absolute inset-0">
            {outParticles.map((_, i) => (
              <motion.div
                key={i}
                className="absolute top-1/2 size-2 rounded-full"
                style={glowOut}
                initial={{ left: '96%', opacity: 0 }}
                animate={{ left: ['96%', '50%', '2%'], opacity: [0, 1, 0.9] }}
                transition={{
                  duration: 1.5,
                  delay: 2.9 + (i / scene.visualMassOut) * 1.1,
                  ease: 'easeOut',
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* price + amounts readout */}
      <div className="absolute bottom-[10%] left-1/2 w-full max-w-md -translate-x-1/2 px-6 text-center">
        <div className="flex items-baseline justify-center gap-2 font-mono text-lg text-zinc-100 tabular-nums sm:text-xl">
          <CountUp
            value={unitsIn}
            format={(v) => `${v.toFixed(Math.min(inDecimals, 2))} ${tokenIn.label}`}
            durationMs={1800}
          />
          <span className="text-zinc-500">→</span>
          <CountUp
            value={unitsOut}
            format={(v) => `${v.toFixed(Math.min(outDecimals, 4))} ${tokenOut.label}`}
            durationMs={1800}
          />
        </div>
        {scene.priceLabel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 3.4, duration: 0.6 }}
            className="mt-1.5 text-xs text-amber-200/80"
          >
            {scene.priceLabel} · tick {scene.endTick.toLocaleString('en-US')}
          </motion.div>
        )}
      </div>
    </div>
  )
}
