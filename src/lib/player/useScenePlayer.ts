'use client'

import { useMotionValue } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

export interface ScenePlayerState {
  index: number
  playing: boolean
  finished: boolean
}

// Scene-granular clock: one rAF loop accumulates elapsed time for the current
// scene and advances the index when its duration passes. Per-frame progress
// lives in a MotionValue (written by the loop, read directly by CSS) so the
// whole Stage does NOT re-render sixty times a second — React state updates
// only on scene changes and play-state changes. The absolute position also
// lives in a ref, written only from callbacks/rAF, never during render.
// Scenes are discrete — V1 has play / pause / jump / replay, not scrubbing.
export function useScenePlayer(durations: number[]) {
  const prefersReducedMotion = usePrefersReducedMotion()
  // reduced motion → near-instant scenes: a fast storyboard, no big movement
  const effectiveDurations = useMemo(
    () => durations.map((d) => (prefersReducedMotion ? Math.min(d, 500) : d)),
    [durations, prefersReducedMotion],
  )

  const [state, setState] = useState<ScenePlayerState>({
    index: 0,
    playing: true,
    finished: false,
  })
  const progress = useMotionValue(0)

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
          progress.set(0)
          setState({ index: pos.index, playing: true, finished: false })
        } else {
          // film over — stop the loop, hold the last frame
          pos.elapsed = duration
          progress.set(1)
          setState({ index: pos.index, playing: false, finished: true })
          return
        }
      } else {
        progress.set(pos.elapsed / duration)
      }
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [state.playing, effectiveDurations, progress])

  const jumpTo = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(index, effectiveDurations.length - 1))
      positionRef.current = { index: clamped, elapsed: 0 }
      progress.set(0)
      setState({ index: clamped, playing: true, finished: false })
    },
    [effectiveDurations.length, progress],
  )

  const toggle = useCallback(() => {
    if (state.finished) {
      positionRef.current = { index: 0, elapsed: 0 }
      progress.set(0)
      setState({ index: 0, playing: true, finished: false })
      return
    }
    setState((s) => ({ ...s, playing: !s.playing }))
  }, [state.finished, progress])

  const restart = useCallback(() => {
    positionRef.current = { index: 0, elapsed: 0 }
    progress.set(0)
    setState({ index: 0, playing: true, finished: false })
  }, [progress])

  return {
    index: state.index,
    playing: state.playing,
    finished: state.finished,
    // per-frame, MotionValue-driven — bind it via style, not via state
    progress,
    jumpTo,
    toggle,
    restart,
  }
}
