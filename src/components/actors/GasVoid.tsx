'use client'

import { motion, useTransform } from 'framer-motion'
import { sampleKeyframes, useSceneProgress } from '@/lib/player/sceneTimeline'

function GasMote({
  start,
  mid,
  delayMs,
}: {
  start: { x: number; y: number }
  mid: { x: number; y: number }
  delayMs: number
}) {
  const progress = useSceneProgress({
    delayMs,
    durationMs: 2100,
    easing: 'easeIn',
    repeat: true,
    repeatDelayMs: 400,
  })
  const x = useTransform(progress, (value) => sampleKeyframes([start.x, mid.x, 0], value))
  const y = useTransform(progress, (value) => sampleKeyframes([start.y, mid.y, 0], value))
  const opacity = useTransform(progress, (value) => sampleKeyframes([0, 0.9, 0], value))
  const scale = useTransform(progress, (value) => sampleKeyframes([1, 0.8, 0.15], value))

  return (
    <motion.span
      className="absolute top-1/2 left-1/2 size-1.5 rounded-full bg-zinc-500"
      style={{ x, y, opacity, scale }}
    />
  )
}

function GasCore() {
  const progress = useSceneProgress({ durationMs: 2800, easing: 'easeInOut', repeat: true })
  const scale = useTransform(progress, (value) => sampleKeyframes([1, 1.045, 1], value))
  return (
    <motion.div
      aria-hidden
      className="absolute inset-0 rounded-full"
      style={{
        scale,
        background:
          'radial-gradient(circle at 50% 46%, #000 0%, #050507 38%, rgb(24 24 27 / 0.92) 66%, rgb(39 39 42 / 0.35) 88%, transparent 100%)',
        boxShadow: '0 0 90px 26px rgb(0 0 0 / 0.85), inset 0 0 24px 6px rgb(0 0 0 / 0.9)',
      }}
    />
  )
}

// The recurring character: a black hole with an appetite. Present in every
// story — gas is the one thing every transaction pays, successful or not.
// Three motes fall in on curved paths while the core breathes: matter in,
// nothing out.
export function GasVoid({ size = 140 }: { size?: number }) {
  const radius = size / 2
  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* infalling motes: start outside, spiral in, vanish */}
      {[
        { angle: -60, delay: 0 },
        { angle: 80, delay: 0.8 },
        { angle: 170, delay: 1.6 },
      ].map(({ angle, delay }, i) => {
        const rad = (angle * Math.PI) / 180
        const start = { x: Math.cos(rad) * (radius + 34), y: Math.sin(rad) * (radius + 34) }
        const mid = { x: Math.cos(rad + 1.9) * (radius * 0.7), y: Math.sin(rad + 1.9) * (radius * 0.7) }
        return (
          <GasMote
            key={i}
            start={start}
            mid={mid}
            delayMs={delay * 1000}
          />
        )
      })}

      {/* the core: event-horizon gradient, breathing */}
      <GasCore />
    </div>
  )
}
