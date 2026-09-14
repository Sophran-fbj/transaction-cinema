'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

export interface ScenePlayerState {
  index: number
  elapsed: number // ms into the current scene
  playing: boolean
  finished: boolean
}

// Scene-granular clock: one rAF loop accumulates elapsed time for the current
// scene and advances the index when its duration passes. The position lives in
// a ref (written only from callbacks/rAF, never during render); React state is
// a per-frame mirror for the UI. Scenes are discrete — V1 has play / pause /
// jump / replay, not frame-level scrubbing.
export function useScenePlayer(durations: number[]) {
  const prefersReducedMotion = usePrefersReducedMotion()
  // reduced motion → near-instant scenes: a fast storyboard, no big movement
  const effectiveDurations = useMemo(
    () => durations.map((d) => (prefersReducedMotion ? Math.min(d, 500) : d)),
    [durations, prefersReducedMotion],
  )

  const [state, setState] = useState<ScenePlayerState>({
    index: 0,
    elapsed: 0,
    playing: true,
    finished: false,
  })

  // source of truth for the rAF loop
  const positionRef = useRef({ index: 0, elapsed: 0 })

  useEffect(() => {
    if (!state.playing) return
    let raf = 0
    let last = performance.now()

    const tick = (now: number) => {
      const dt = now - last
      last = now
      const pos = positionRef.current
      pos.elapsed += dt
      const duration = effectiveDurations[pos.index] ?? 0

      if (pos.elapsed >= duration) {
        if (pos.index + 1 < effectiveDurations.length) {
          pos.index += 1
          pos.elapsed = 0
          setState({ index: pos.index, elapsed: 0, playing: true, finished: false })
        } else {
          // film over — stop the loop, hold the last frame
          pos.elapsed = duration
          setState({ index: pos.index, elapsed: duration, playing: false, finished: true })
          return
        }
      } else {
        setState({ index: pos.index, elapsed: pos.elapsed, playing: true, finished: false })
      }
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [state.playing, state.index, effectiveDurations])

  const jumpTo = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(index, effectiveDurations.length - 1))
      positionRef.current = { index: clamped, elapsed: 0 }
      setState({ index: clamped, elapsed: 0, playing: true, finished: false })
    },
    [effectiveDurations.length],
  )

  const toggle = useCallback(() => {
    setState((s) => {
      if (s.finished) {
        positionRef.current = { index: 0, elapsed: 0 }
        return { index: 0, elapsed: 0, playing: true, finished: false }
      }
      return { ...s, playing: !s.playing }
    })
  }, [])

  const restart = useCallback(() => {
    positionRef.current = { index: 0, elapsed: 0 }
    setState({ index: 0, elapsed: 0, playing: true, finished: false })
  }, [])

  const duration = effectiveDurations[state.index] || 1
  return {
    ...state,
    progress: state.elapsed / duration,
    jumpTo,
    toggle,
    restart,
  }
}
