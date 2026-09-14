'use client'

import { animate, motion, useMotionValue, useTransform } from 'framer-motion'
import { useEffect } from 'react'

// Single count-up primitive used by every scene: the odometer feel comes from
// one implementation, so numbers across the film tick the same way. `from`
// lets scenes count DOWN too — the revert rewind runs amounts back to zero.
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
  const mv = useMotionValue(from)
  const text = useTransform(mv, (v) => format(v))

  useEffect(() => {
    mv.set(from)
    const controls = animate(mv, value, { duration: durationMs / 1000, ease: [0.16, 1, 0.3, 1] })
    return () => controls.stop()
  }, [from, value, durationMs, mv])

  return <motion.span className={className}>{text}</motion.span>
}
