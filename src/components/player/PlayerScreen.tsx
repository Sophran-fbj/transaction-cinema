'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { isHash } from 'viem'
import { Stage } from '@/components/stage/Stage'
import { getChainConfig } from '@/lib/chain/chains'
import { enrichPoolInfo, enrichTokenMeta } from '@/lib/decode/enrich'
import { TxNotMinedError, TxNotFoundError, getTxBundle } from '@/lib/fetch/getTxBundle'
import { buildStory } from '@/lib/story/build'
import type { Story } from '@/lib/story/types'

type State =
  | { status: 'loading' }
  | { status: 'ready'; story: Story }
  | { status: 'error'; message: string }

// Client-side only: the browser talks to public RPC endpoints directly.
// No wallet, no backend, no API keys required.
export function PlayerScreen({ chainSlug, hash }: { chainSlug: string; hash: string }) {
  const [state, setState] = useState<State>({ status: 'loading' })

  // input validation is synchronous — derive it during render, not in an effect
  const validationError = !getChainConfig(chainSlug)
    ? 'V1 plays Ethereum mainnet only — try /play/eth/<hash>.'
    : !isHash(hash)
      ? 'That does not look like a transaction hash (0x followed by 64 hex chars).'
      : null

  useEffect(() => {
    // isHash narrows `hash` to `0x${string}` for the fetch below
    if (validationError || !isHash(hash)) return
    let cancelled = false
    getTxBundle(hash)
      // token metadata multicall, then pool attribution (each a no-op when
      // the tx has no Transfer events / V3 Swap event)
      .then((bundle) => enrichTokenMeta(bundle))
      .then((bundle) => enrichPoolInfo(bundle))
      .then((bundle) => {
        if (!cancelled) setState({ status: 'ready', story: buildStory(bundle) })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        if (error instanceof TxNotFoundError || error instanceof TxNotMinedError) {
          setState({ status: 'error', message: error.message })
        } else {
          setState({
            status: 'error',
            message: 'RPC fetch failed — public endpoints rate-limit. Try again in a moment.',
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [chainSlug, hash, validationError])

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-8 sm:px-8">
      <header className="mb-6">
        <Link
          href="/"
          className="text-xs tracking-[0.3em] text-zinc-500 uppercase transition-colors hover:text-zinc-300"
        >
          ← Transaction Cinema
        </Link>
      </header>

      {validationError ? (
        <ErrorNotice message={validationError} />
      ) : state.status === 'loading' ? (
        <LoadingFilm />
      ) : state.status === 'error' ? (
        <ErrorNotice message={state.message} />
      ) : null}

      {state.status === 'ready' && (
        <>
          <div className="mb-5 text-center">
            <h1 className="text-lg font-medium text-zinc-100">{state.story.title}</h1>
            <p className="mt-1 text-sm text-zinc-500">{state.story.synopsis}</p>
          </div>
          <Stage story={state.story} />
        </>
      )}
    </main>
  )
}

function LoadingFilm() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4">
      <div className="flex gap-1.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="size-2.5 animate-pulse rounded-full bg-zinc-600"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
      <p className="text-sm text-zinc-500">Loading the film — fetching raw RPC data…</p>
    </div>
  )
}

function ErrorNotice({ message }: { message: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <p className="max-w-md text-sm text-zinc-400">{message}</p>
      <Link
        href="/"
        className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs text-zinc-300 transition-colors hover:bg-white/10"
      >
        Back to the lobby
      </Link>
    </div>
  )
}
