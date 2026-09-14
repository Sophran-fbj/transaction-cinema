'use client'

import { motion } from 'framer-motion'
import { formatEther } from 'viem'
import type { Actor, Scene } from '@/lib/story/types'
import { ActorCard } from '@/components/actors/ActorCard'
import { Identicon } from '@/components/actors/Identicon'
import { particleStyle } from '@/components/actors/actorVisual'
import { CountUp } from '@/components/primitives/CountUp'

function TokenChip({ actor }: { actor: Actor }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
      <Identicon seed={actor.address ?? actor.id} kind={actor.kind} size={16} />
      <span className="text-xs text-zinc-300">{actor.label}</span>
    </span>
  )
}

// The value-in-motion scene. Particle count comes from `visualMass` — a real
// bigint amount mapped by the story layer — and the ticking counter lands on
// the exact onchain value. Native ETH keeps the fixed amber treatment; tokens
// are colored by their own address, matching their identicon.
export function TransferScene({
  scene,
  cast,
}: {
  scene: Extract<Scene, { type: 'transfer' }>
  cast: Record<string, Actor>
}) {
  const from = cast[scene.from]
  const to = cast[scene.to]
  const asset = cast[scene.asset]
  if (!from || !to || !asset) return null

  const isNative = asset.kind === 'native'
  const unit = asset.label

  // native: derive the number from wei; token: use the builder's pre-formatted values
  const countValue = isNative ? Number(scene.amount) / 1e18 : (scene.amountNumber ?? 0)
  // how many decimals to show while ticking — taken from the exact final string
  const decimals = isNative
    ? 4
    : (scene.displayAmount?.split('.')[1]?.length ?? 0)

  const particles = Array.from({ length: scene.visualMass })
  const glow = particleStyle(asset)

  return (
    <div className="relative flex h-full items-center justify-between px-8 sm:px-16">
      <ActorCard actor={from} role="Sender" />
      <ActorCard actor={to} role="Recipient" />

      {/* flight path: particles leave the sender and arrive at the recipient
          (interrupted: they stall mid-air — a failed tx never delivers) */}
      <div className="pointer-events-none absolute inset-0">
        {particles.map((_, i) => {
          const wave = ((i % 5) - 2) * 14
          const up = wave - 16
          return (
            <motion.div
              key={i}
              className="absolute size-2.5 rounded-full"
              style={glow}
              initial={{ left: '16%', top: `calc(50% + ${wave}px)`, opacity: 0, scale: 0.6 }}
              animate={
                scene.interrupted
                  ? {
                      left: ['16%', '42%', '54%', '53%', '55%', '54%'],
                      top: [
                        `calc(50% + ${wave}px)`,
                        `calc(50% + ${up}px)`,
                        `calc(50% + ${up}px)`,
                        `calc(50% + ${up + 1}px)`,
                        `calc(50% + ${up - 1}px)`,
                        `calc(50% + ${up}px)`,
                      ],
                      opacity: [0, 1, 1, 1, 1, 1],
                      scale: [0.6, 1, 1, 1, 1, 1],
                    }
                  : {
                      left: ['16%', '45%', '60%', '84%'],
                      top: [
                        `calc(50% + ${wave}px)`,
                        `calc(50% + ${up}px)`,
                        `calc(50% + ${up}px)`,
                        `calc(50% + ${wave}px)`,
                      ],
                      opacity: [0, 1, 1, 0],
                      scale: [0.6, 1, 1, 0.9],
                    }
              }
              transition={{
                duration: 1.8,
                delay: 0.35 + (i / scene.visualMass) * 1.1,
                ease: 'easeInOut',
                times: scene.interrupted ? [0, 0.4, 0.7, 0.8, 0.9, 1] : [0, 0.35, 0.7, 1],
              }}
            />
          )
        })}
      </div>

      {/* asset chip + amount counter under the flight path */}
      <div className="absolute bottom-[16%] left-1/2 flex -translate-x-1/2 flex-col items-center gap-1.5 text-center">
        {!isNative ? <TokenChip actor={asset} /> : null}
        <CountUp
          value={countValue}
          format={(v) => (isNative ? `${v.toFixed(4)} ETH` : `${v.toFixed(decimals)} ${unit}`)}
          durationMs={2200}
          className="font-mono text-2xl text-zinc-100 tabular-nums"
        />
        {isNative ? (
          <div className="text-[11px] text-zinc-500">exact: {formatEther(scene.amount)} ETH</div>
        ) : (
          <div className="text-[11px] text-zinc-500">
            exact: {scene.displayAmount} {unit}
            {scene.assumedDecimals ? ' · 18 decimals assumed' : ''}
          </div>
        )}
      </div>
    </div>
  )
}
