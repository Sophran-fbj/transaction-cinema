'use client'

import { useTransform, type MotionValue } from 'framer-motion'
import { useSceneElapsed } from './ScenePlaybackContext'

export type SceneEase = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut'

export interface SceneTimeline {
  delayMs?: number
  durationMs: number
  easing?: SceneEase
  repeat?: boolean
  repeatDelayMs?: number
}

function applyEase(progress: number, easing: SceneEase) {
  if (easing === 'easeIn') return progress * progress
  if (easing === 'easeOut') return 1 - (1 - progress) ** 2
  if (easing === 'easeInOut') return progress * progress * (3 - 2 * progress)
  return progress
}

// Every visual timeline is a pure projection of the player's elapsed scene
// time. Nothing here owns a timer, so pause and replay affect every property
// on exactly the same frame.
export function useSceneProgress({
  delayMs = 0,
  durationMs,
  easing = 'linear',
  repeat = false,
  repeatDelayMs = 0,
}: SceneTimeline): MotionValue<number> {
  const elapsed = useSceneElapsed()

  return useTransform(elapsed, (elapsedMs) => {
    let localMs = elapsedMs - delayMs
    if (localMs <= 0) return 0

    if (repeat) {
      const cycleMs = Math.max(1, durationMs + repeatDelayMs)
      localMs %= cycleMs
      if (localMs >= durationMs) return 1
    }

    const linear = Math.min(1, Math.max(0, localMs / Math.max(1, durationMs)))
    return applyEase(linear, easing)
  })
}

export function sampleKeyframes(values: readonly number[], progress: number, times?: readonly number[]) {
  if (values.length === 0) return 0
  if (values.length === 1) return values[0]

  const stops =
    times && times.length === values.length
      ? times
      : values.map((_, index) => index / (values.length - 1))
  const clamped = Math.min(1, Math.max(0, progress))
  let index = stops.length - 2

  for (let i = 0; i < stops.length - 1; i += 1) {
    if (clamped <= stops[i + 1]) {
      index = i
      break
    }
  }

  const span = Math.max(Number.EPSILON, stops[index + 1] - stops[index])
  const local = Math.min(1, Math.max(0, (clamped - stops[index]) / span))
  return values[index] + (values[index + 1] - values[index]) * local
}
