'use client'

import type { ActorKind } from '@/lib/story/types'
import { hashSeed } from './actorVisual'

const KIND_STYLES: Partial<Record<ActorKind, string>> = {
  native: 'bg-linear-[135deg] from-amber-200 via-amber-400 to-amber-600',
  gas: 'bg-zinc-950',
}

export function Identicon({
  seed,
  kind = 'eoa',
  size = 56,
}: {
  seed: string
  kind?: ActorKind
  size?: number
}) {
  const fixed = KIND_STYLES[kind]
  const style = fixed
    ? undefined
    : (() => {
        const h = hashSeed(seed)
        const hue1 = h % 360
        const hue2 = (h >>> 3) % 360
        return { background: `linear-gradient(135deg, hsl(${hue1} 65% 55%), hsl(${hue2} 60% 40%))` }
      })()

  return (
    <div
      aria-hidden
      className={`flex items-center justify-center rounded-xl border border-white/10 shadow-lg shadow-black/40 ${fixed ?? ''}`}
      style={{ width: size, height: size, ...style }}
    >
      {kind === 'native' ? <span className="font-serif text-2xl text-amber-950">Ξ</span> : null}
    </div>
  )
}
