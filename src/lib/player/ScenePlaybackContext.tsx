'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { MotionValue } from 'framer-motion'

const ScenePlaybackContext = createContext<MotionValue<number> | null>(null)

export function ScenePlaybackProvider({
  elapsed,
  children,
}: {
  elapsed: MotionValue<number>
  children: ReactNode
}) {
  return (
    <ScenePlaybackContext.Provider value={elapsed}>
      {children}
    </ScenePlaybackContext.Provider>
  )
}

// One clock for every moving part in a scene. The player is the only writer;
// pausing it stops this value, so DOM animations, counters and delayed beats
// all freeze on the same frame and resume from the same timestamp.
export function useSceneElapsed(): MotionValue<number> {
  const elapsed = useContext(ScenePlaybackContext)
  if (!elapsed) throw new Error('useSceneElapsed must be used inside a scene player')
  return elapsed
}
