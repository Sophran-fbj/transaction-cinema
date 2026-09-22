'use client'

import { motion, useTransform } from 'framer-motion'
import type { CSSProperties } from 'react'
import { formatEther } from 'viem'
import type { Actor, Scene } from '@/lib/story/types'
import { ActorCard } from '@/components/actors/ActorCard'
import { Identicon } from '@/components/actors/Identicon'
import { particleStyle } from '@/components/actors/actorVisual'
import { CountUp } from '@/components/primitives/CountUp'
import { sampleKeyframes, useSceneProgress } from '@/lib/player/sceneTimeline'

function TransferParticle({
  interrupted,
  wave,
  delayMs,
  style,
}: {
  interrupted: boolean
  wave: number
  delayMs: number
  style: CSSProperties
}) {
  const progress = useSceneProgress({ delayMs, durationMs: 1800, easing: 'easeInOut' })
  const up = wave - 16
  const times = interrupted ? [0, 0.4, 0.7, 0.8, 0.9, 1] : [0, 0.35, 0.7, 1]
  const leftValues = interrupted ? [16, 42, 54, 53, 55, 54] : [16, 45, 60, 84]
  const topValues = interrupted
    ? [wave, up, up, up + 1, up - 1, up]
    : [wave, up, up, wave]
  const opacityValues = interrupted ? [0, 1, 1, 1, 1, 1] : [0, 1, 1, 0]
  const scaleValues = interrupted ? [0.6, 1, 1, 1, 1, 1] : [0.6, 1, 1, 0.9]
  const left = useTransform(progress, (value) => `${sampleKeyframes(leftValues, value, times)}%`)
  const top = useTransform(progress, (value) => `calc(50% + ${sampleKeyframes(topValues, value, times)}px)`)
  const opacity = useTransform(progress, (value) => sampleKeyframes(opacityValues, value, times))
  const scale = useTransform(progress, (value) => sampleKeyframes(scaleValues, value, times))

  return (
    <motion.div
      className="absolute size-2.5 rounded-full"
      style={{ ...style, left, top, opacity, scale }}
    />
  )
}

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
          return (
            <TransferParticle
              key={i}
              interrupted={Boolean(scene.interrupted)}
              wave={wave}
              delayMs={350 + (i / scene.visualMass) * 1100}
              style={glow}
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
