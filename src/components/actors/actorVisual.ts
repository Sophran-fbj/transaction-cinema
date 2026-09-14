import type { Actor } from '@/lib/story/types'

// Deterministic visual identity for an actor, derived from its address —
// no logo API. The identicon and the flying particles share this hue, so a
// token looks like itself everywhere on the stage.

export function hashSeed(seed: string): number {
  let h = 5381
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) + h + seed.charCodeAt(i)) >>> 0
  }
  return h
}

// Native ETH keeps the fixed amber accent; every other actor derives
// a stable pair of hues from its seed (address or id).
export function actorHues(actor: Actor | undefined): { hue1: number; hue2: number } {
  if (actor?.kind === 'native') return { hue1: 43, hue2: 38 } // amber family
  const h = hashSeed(actor?.address ?? actor?.id ?? 'unknown')
  return { hue1: h % 360, hue2: (h >>> 3) % 360 }
}

export function particleStyle(actor: Actor | undefined): {
  background: string
  boxShadow: string
} {
  const { hue1 } = actorHues(actor)
  const base = actor?.kind === 'native' ? 'hsl(48 96% 68%)' : `hsl(${hue1} 70% 62%)`
  return {
    background: base,
    boxShadow: `0 0 12px 2px ${actor?.kind === 'native' ? 'rgb(252 211 77 / 0.45)' : `hsl(${hue1} 70% 62% / 0.45)`}`,
  }
}
