'use client'

import { useSyncExternalStore } from 'react'

// SSR-safe prefers-reduced-motion probe via useSyncExternalStore. When true,
// the player compresses scene durations (near-static storyboard) and
// MotionConfig disables transform animations — the story stays fully
// readable, minus the motion.
function subscribe(onChange: () => void) {
  const query = window.matchMedia('(prefers-reduced-motion: reduce)')
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => false, // SSR: assume motion allowed
  )
}
