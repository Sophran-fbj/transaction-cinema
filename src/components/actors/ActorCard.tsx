'use client'

import type { Actor } from '@/lib/story/types'
import { Identicon } from './Identicon'

export function ActorCard({ actor, role }: { actor: Actor; role: string }) {
  return (
    <div className="flex w-24 flex-col items-center gap-2 text-center sm:w-28">
      <Identicon seed={actor.address ?? actor.id} kind={actor.kind} />
      <div>
        <div className="font-mono text-sm text-zinc-200">{actor.label}</div>
        <div className="text-[10px] tracking-[0.2em] text-zinc-500 uppercase">{role}</div>
      </div>
    </div>
  )
}
