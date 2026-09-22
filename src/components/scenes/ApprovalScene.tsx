'use client'

import { motion, useMotionValueEvent, useTransform } from 'framer-motion'
import { useState, type ReactNode } from 'react'
import type { Actor, Scene } from '@/lib/story/types'
import { ActorCard } from '@/components/actors/ActorCard'
import { actorHues } from '@/components/actors/actorVisual'
import { CountUp } from '@/components/primitives/CountUp'
import { useSceneElapsed } from '@/lib/player/ScenePlaybackContext'
import { sampleKeyframes, useSceneProgress } from '@/lib/player/sceneTimeline'

// The approval scene: a permission badge — the "vault key" — flies from the
// owner to the spender (or back, on revoke), and the spender's padlock opens
// (or slams shut). Unlimited approvals fly an ∞ instead of a number: the
// metaphor is a signed blank check, kept deliberately uneasy.

function LockIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke={open ? 'rgb(252 211 77)' : 'rgb(248 113 113)'}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="4" y="11" width="16" height="10" rx="2" />
      {open ? <path d="M8 11V7a4 4 0 0 1 7.9-.9" /> : <path d="M8 11V7a4 4 0 0 1 8 0v4" />}
    </svg>
  )
}

function PermissionBadge({
  from,
  to,
  hue,
  children,
}: {
  from: number
  to: number
  hue: number
  children: ReactNode
}) {
  const progress = useSceneProgress({ delayMs: 400, durationMs: 2000, easing: 'easeInOut' })
  const left = useTransform(progress, (value) => `${sampleKeyframes([from, 50, to], value)}%`)
  const top = useTransform(progress, (value) => `${sampleKeyframes([50, 42, 50], value)}%`)
  const opacity = useTransform(progress, (value) => sampleKeyframes([0, 1, 1], value))
  const scale = useTransform(progress, (value) => sampleKeyframes([0.6, 1.1, 1], value))

  return (
    <motion.div
      className="absolute flex size-16 -translate-y-1/2 items-center justify-center rounded-full border-2 font-mono text-lg"
      style={{
        left,
        top,
        opacity,
        scale,
        borderColor: `hsl(${hue} 70% 62%)`,
        background: `hsl(${hue} 70% 62% / 0.12)`,
        boxShadow: `0 0 32px 6px hsl(${hue} 70% 62% / 0.35)`,
        color: `hsl(${hue} 80% 75%)`,
      }}
    >
      {children}
    </motion.div>
  )
}

export function ApprovalScene({
  scene,
  cast,
}: {
  scene: Extract<Scene, { type: 'approval' }>
  cast: Record<string, Actor>
}) {
  const owner = cast[scene.owner]
  const spender = cast[scene.spender]
  const token = cast[scene.token]

  const isUnlimited = scene.mode === 'unlimited'
  const isRevoke = scene.mode === 'revoke'

  // lock flips shortly after the badge reaches its destination — unless the
  // approval was only ATTEMPTED (failed tx): then the vault stays locked
  const [lockOpen, setLockOpen] = useState(isRevoke && !scene.attempted ? true : false)
  const elapsed = useSceneElapsed()
  useMotionValueEvent(elapsed, 'change', (elapsedMs) => {
    if (scene.attempted) return
    const next = elapsedMs >= (isRevoke ? 1600 : 2200) ? !isRevoke : isRevoke
    setLockOpen((current) => (current === next ? current : next))
  })

  if (!owner || !spender || !token) return null

  const { hue1 } = actorHues(token)

  // flight path direction: grant goes owner→spender, revoke flies back
  const from = isRevoke ? 84 : 16
  const to = isRevoke ? 16 : 84

  const decimals = scene.displayAmount?.split('.')[1]?.length ?? 0

  return (
    <div className="relative flex h-full items-center justify-between px-8 sm:px-16">
      <div className="flex flex-col items-center gap-3">
        <ActorCard actor={owner} role="Owner" />
        {/* the vault lives with the owner */}
        <div
          className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5"
          style={{ boxShadow: `0 0 24px 4px hsl(${hue1} 70% 62% / 0.15)` }}
        >
          <span className="text-[10px] tracking-[0.2em] text-zinc-500 uppercase">vault</span>
          <span className="font-mono text-xs text-zinc-300">{token.label}</span>
        </div>
      </div>

      <div className="flex flex-col items-center gap-3">
        <ActorCard actor={spender} role="Spender" />
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
          <span className="text-[10px] tracking-[0.2em] text-zinc-500 uppercase">access</span>
          <LockIcon open={lockOpen} />
        </div>
      </div>

      {/* the flying permission badge */}
      <div className="pointer-events-none absolute inset-0">
        <PermissionBadge from={from} to={to} hue={hue1}>
          {isUnlimited ? '∞' : null}
        </PermissionBadge>
      </div>

      {/* amount readout under the flight path */}
      <div className="absolute bottom-[14%] left-1/2 -translate-x-1/2 text-center">
        {isUnlimited ? (
          <div className={`font-mono text-2xl ${isRevoke ? '' : 'text-amber-200'}`}>
            unlimited allowance
          </div>
        ) : (
          <CountUp
            value={scene.amountNumber ?? 0}
            format={(v) => `${v.toFixed(decimals)} ${token.label}`}
            durationMs={2200}
            className="font-mono text-2xl text-zinc-100 tabular-nums"
          />
        )}
        {scene.assumedDecimals ? (
          <div className="mt-1 text-[11px] text-zinc-500">18 decimals assumed</div>
        ) : null}
      </div>
    </div>
  )
}
