'use client'

import { useLayoutEffect, useRef, type ReactNode } from 'react'
import type { MotionValue } from 'framer-motion'

// Motion normally gives every element its own autonomous clock. Here those
// browser animations are paused permanently and their currentTime is driven
// from the player's scene clock. There is no pause/resume race: if scene time
// does not move, no visual animation can move either.
export function SceneAnimationBoundary({
  elapsed,
  sceneRunId,
  children,
}: {
  elapsed: MotionValue<number>
  sceneRunId: number
  children: ReactNode
}) {
  const rootRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    const tracked = new Set<Animation>()

    const sync = (sceneTimeMs: number) => {
      const current = new Set(root.getAnimations({ subtree: true }))

      for (const animation of current) {
        if (!tracked.has(animation)) {
          animation.pause()
          tracked.add(animation)
        }
        // Every declarative scene animation is authored relative to the start
        // of the scene, including its own transition.delay. Using the time at
        // which we happened to discover it would apply that delay twice and
        // make delayed particles pop in after resume.
        animation.currentTime = Math.max(0, sceneTimeMs)
      }

      for (const animation of tracked) {
        if (!current.has(animation)) tracked.delete(animation)
      }
    }

    sync(elapsed.get())
    const unsubscribe = elapsed.on('change', sync)
    return () => {
      unsubscribe()
      tracked.clear()
    }
  }, [elapsed, sceneRunId])

  return (
    <div ref={rootRef} className="absolute inset-0">
      {children}
    </div>
  )
}
