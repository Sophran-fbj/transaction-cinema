'use client'

import { useMotionValue } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

export interface ScenePlayerState {
  index: number
  playing: boolean
  finished: boolean
  // Incrementing this remounts the active scene even when its index does not
  // change. Restart/replay must reset both the clock and the visual timeline.
  sceneRunId: number
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
    sceneRunId: 0,
  })
  const progress = useMotionValue(0)
  const elapsed = useMotionValue(0)

  // source of truth for the rAF loop
  const positionRef = useRef({ index: 0, elapsed: 0 })
  // Event handlers update this synchronously, before React effects clean up,
  // so a pause click cannot leak one more animation frame into scene time.
  const playingRef = useRef(true)

  useEffect(() => {
    if (!state.playing) return
    let raf = 0
    let last = performance.now()

    const tick = (now: number) => {
      if (!playingRef.current) return
      const dt = now - last
      last = now
      const pos = positionRef.current
      pos.elapsed += dt
      const duration = effectiveDurations[pos.index] ?? 0

      if (pos.elapsed >= duration) {
        if (pos.index + 1 < effectiveDurations.length) {
          pos.index += 1
          pos.elapsed = 0
          elapsed.set(0)
          progress.set(0)
          setState((current) => ({
            index: pos.index,
            playing: true,
            finished: false,
            sceneRunId: current.sceneRunId + 1,
          }))
        } else {
          // film over — stop the loop, hold the last frame
          pos.elapsed = duration
          playingRef.current = false
          elapsed.set(duration)
          progress.set(1)
          setState((current) => ({
            index: pos.index,
            playing: false,
            finished: true,
            sceneRunId: current.sceneRunId,
          }))
          return
        }
      } else {
        elapsed.set(pos.elapsed)
        progress.set(pos.elapsed / duration)
      }
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [state.playing, state.sceneRunId, effectiveDurations, elapsed, progress])

  const jumpTo = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(index, effectiveDurations.length - 1))
      playingRef.current = true
      positionRef.current = { index: clamped, elapsed: 0 }
      elapsed.set(0)
      progress.set(0)
      setState((current) => ({
        index: clamped,
        playing: true,
        finished: false,
        sceneRunId: current.sceneRunId + 1,
      }))
    },
    [effectiveDurations.length, elapsed, progress],
  )

  const toggle = useCallback(() => {
    if (state.finished) {
      playingRef.current = true
      positionRef.current = { index: 0, elapsed: 0 }
      elapsed.set(0)
      progress.set(0)
      setState((current) => ({
        index: 0,
        playing: true,
        finished: false,
        sceneRunId: current.sceneRunId + 1,
      }))
      return
    }
    const playing = !state.playing
    playingRef.current = playing
    setState((s) => ({ ...s, playing }))
  }, [state.finished, state.playing, elapsed, progress])

  const restart = useCallback(() => {
    playingRef.current = true
    positionRef.current = { index: 0, elapsed: 0 }
    elapsed.set(0)
    progress.set(0)
    setState((current) => ({
      index: 0,
      playing: true,
      finished: false,
      sceneRunId: current.sceneRunId + 1,
    }))
  }, [elapsed, progress])

  const replayCurrent = useCallback(() => {
    const index = positionRef.current.index
    playingRef.current = true
    positionRef.current = { index, elapsed: 0 }
    elapsed.set(0)
    progress.set(0)
    setState((current) => ({
      index,
      playing: true,
      finished: false,
      sceneRunId: current.sceneRunId + 1,
    }))
  }, [elapsed, progress])

  return {
    index: state.index,
    playing: state.playing,
    finished: state.finished,
    sceneRunId: state.sceneRunId,
    // per-frame, MotionValue-driven — bind it via style, not via state
    progress,
    elapsed,
    jumpTo,
    toggle,
    restart,
    replayCurrent,
  }
}
