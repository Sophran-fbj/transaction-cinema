'use client'

import { animate, motion, useMotionValue, useTransform } from 'framer-motion'
import { useEffect } from 'react'
import { usePrefersReducedMotion } from '@/lib/player/usePrefersReducedMotion'

// Single count-up primitive used by every scene: the odometer feel comes from
// one implementation, so numbers across the film tick the same way. `from`
// lets scenes count DOWN too — the revert rewind runs amounts back to zero.
// Under prefers-reduced-motion the player compresses scenes to ~500ms, so the
// count snaps straight to the final value — a 1.4–2.2s odometer would get cut
// off before showing where it lands.
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
  const mv = useMotionValue(from)
  const text = useTransform(mv, (v) => format(v))

  useEffect(() => {
    mv.set(from)
    const controls = animate(mv, value, {
      duration: prefersReducedMotion ? 0 : durationMs / 1000,
      ease: [0.16, 1, 0.3, 1],
    })
    return () => controls.stop()
  }, [from, value, durationMs, prefersReducedMotion, mv])

  return <motion.span className={className}>{text}</motion.span>
}
