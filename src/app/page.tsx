'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { isHash } from 'viem'
import { DEMO_PRESETS } from '@/content/presets'

// The lobby: one input, one program of real films. No dashboard energy —
// a cinema poster and a "now showing" board.
export default function Home() {
  const router = useRouter()
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  function play(raw: string) {
    // tolerate pasted Etherscan URLs — pull the hash out of anything
    const match = raw.match(/0x[0-9a-fA-F]{64}/)
    const hash = match ? match[0] : raw.trim()
    if (!isHash(hash)) {
      setError('A transaction hash is 0x followed by 64 hex characters.')
      return
    }
    router.push(`/play/eth/${hash}`)
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center justify-center gap-12 px-6 py-16">
      {/* marquee */}
      <div className="text-center">
        <p className="text-[11px] tracking-[0.55em] text-amber-200/70 uppercase">
          transaction cinema
        </p>
        <h1 className="mt-5 text-3xl leading-tight font-medium text-zinc-100 sm:text-4xl">
          Turn any onchain transaction
          <br />
          into a short animated story.
        </h1>
        <p className="mt-4 text-sm text-zinc-500">
          Paste a mainnet transaction hash and press play.
        </p>
      </div>

      {/* the ticket window */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          play(value)
        }}
        className="flex w-full max-w-xl gap-2"
      >
        <input
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setError(null)
          }}
          placeholder="0x…"
          spellCheck={false}
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-3 font-mono text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-amber-300/40 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-lg bg-amber-300 px-5 py-3 text-sm font-medium text-zinc-950 transition-colors hover:bg-amber-200"
        >
          Play
        </button>
      </form>
      {error && <p className="-mt-8 text-xs text-red-400">{error}</p>}

      {/* now showing */}
      <div className="w-full max-w-xl">
        <div className="mb-3 flex items-baseline justify-between">
          <p className="text-[10px] tracking-[0.3em] text-zinc-600 uppercase">now showing</p>
          <p className="text-[10px] text-zinc-700">five real mainnet films</p>
        </div>
        <div className="flex flex-col divide-y divide-white/5 rounded-xl border border-white/10 bg-white/[0.02]">
          {DEMO_PRESETS.map((preset, i) => (
            <Link
              key={preset.hash}
              href={`/play/eth/${preset.hash}`}
              className="group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-white/5"
            >
              <span className="font-mono text-xs text-zinc-600 group-hover:text-amber-200/80">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-zinc-200">{preset.title}</span>
                  <span className="rounded border border-white/10 px-1.5 py-px text-[9px] tracking-widest text-zinc-500 uppercase">
                    {preset.kindLabel}
                  </span>
                </div>
                <div className="mt-0.5 truncate text-xs text-zinc-500">{preset.blurb}</div>
              </div>
              <span className="shrink-0 font-mono text-[10px] text-zinc-600">
                {preset.durationLabel}
              </span>
            </Link>
          ))}
        </div>
      </div>

      <footer className="text-center text-[11px] leading-relaxed text-zinc-600">
        RPC-first · no wallet needed · no indexing APIs
        <br />
        every number on screen decoded from raw transaction, receipt and logs
      </footer>
    </main>
  )
}
