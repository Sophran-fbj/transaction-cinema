'use client'

import { motion, useTransform } from 'framer-motion'
import { usePrefersReducedMotion } from '@/lib/player/usePrefersReducedMotion'
import { useSceneElapsed } from '@/lib/player/ScenePlaybackContext'

// The number is a pure projection of the shared scene clock. No private
// animation is started, so pause/replay cannot drift from the progress bar.
export function CountUp({
  value,
  from = 0,
  format,
  durationMs = 1400,
  className,
}: {
  value: number
  from?: number
  format: (v: number) => string
  durationMs?: number
  className?: string
}) {
  const prefersReducedMotion = usePrefersReducedMotion()
  const elapsed = useSceneElapsed()
  const text = useTransform(elapsed, (elapsedMs) => {
    if (prefersReducedMotion) return format(value)
    const linear = Math.min(1, Math.max(0, elapsedMs / Math.max(1, durationMs)))
    const eased = 1 - (1 - linear) ** 3
    return format(from + (value - from) * eased)
  })

  return <motion.span className={className}>{text}</motion.span>
}
