'use client'

import { formatGwei } from 'viem'
import type { Scene } from '@/lib/story/types'
import { GasVoid } from '@/components/actors/GasVoid'
import { CountUp } from '@/components/primitives/CountUp'

// Real numbers, theatre framing: gasUsed × effectiveGasPrice is exactly what
// the receipt reports — the void is the metaphor, the math is not.
export function GasScene({ scene }: { scene: Extract<Scene, { type: 'gas' }> }) {
  const gwei = Number(formatGwei(scene.effectiveGasPrice))
  const eth = Number(scene.costEth) / 1e18
  const gas = Number(scene.gasUsed)

  return (
    <div className="flex h-full flex-col items-center justify-end pb-10">
      <div className="mb-8 grid grid-cols-3 gap-8 text-center sm:gap-12">
        <div>
          <CountUp
            value={gas}
            format={(v) => v.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            className="block font-mono text-xl text-zinc-100 tabular-nums"
          />
          <div className="mt-1 text-[10px] tracking-[0.2em] text-zinc-500 uppercase">gas units</div>
        </div>
        <div>
          <CountUp
            value={gwei}
            format={(v) => v.toFixed(2)}
            className="block font-mono text-xl text-zinc-100 tabular-nums"
          />
          <div className="mt-1 text-[10px] tracking-[0.2em] text-zinc-500 uppercase">gwei</div>
        </div>
        <div>
          <CountUp
            value={eth}
            format={(v) => `${v.toFixed(6)} ETH`}
            durationMs={1800}
            className="block font-mono text-xl text-amber-200 tabular-nums"
          />
          <div className="mt-1 text-[10px] tracking-[0.2em] text-zinc-500 uppercase">paid</div>
        </div>
      </div>
      <GasVoid />
    </div>
  )
}
