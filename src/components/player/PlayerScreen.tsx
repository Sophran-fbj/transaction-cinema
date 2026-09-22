'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { isHash } from 'viem'
import { Stage } from '@/components/stage/Stage'
import { createRpcClient } from '@/lib/chain/client'
import { getChainConfig } from '@/lib/chain/chains'
import { enrichBundle } from '@/lib/decode/enrich'
import {
  ReceiptUnavailableError,
  TxNotMinedError,
  TxNotFoundError,
  getTxBundle,
} from '@/lib/fetch/getTxBundle'
import { buildStory } from '@/lib/story/build'
import type { Story } from '@/lib/story/types'

type State =
  | { status: 'loading' }
  | { status: 'ready'; story: Story; warnings: string[] }
  | { status: 'error'; message: string; retryable: boolean }

// Client-side only: the browser talks to RPC endpoints directly (same-origin
// proxy first when deployed with one). No wallet, no indexing APIs.
export function PlayerScreen({ chainSlug, hash }: { chainSlug: string; hash: string }) {
  const [state, setState] = useState<State>({ status: 'loading' })
  // Retry re-runs the fetch. The loading switch happens here (an event
  // handler, not an effect): entering a new tx remounts this component via
  // the page's key, so state resets happen at the event/mount boundaries.
  const [attempt, setAttempt] = useState(0)
  const retry = useCallback(() => {
    setAttempt((a) => a + 1)
    setState({ status: 'loading' })
  }, [])

  // input validation is synchronous — derive it during render, not in an effect
  const validationError = !getChainConfig(chainSlug)
    ? 'V1 plays Ethereum mainnet only — try /play/eth/<hash>.'
    : !isHash(hash)
      ? 'That does not look like a transaction hash (0x followed by 64 hex chars).'
      : null

  useEffect(() => {
    // isHash narrows `hash` to `0x${string}` for the fetch below
    if (validationError || !isHash(hash)) return
    const controller = new AbortController()
    let cancelled = false
    const client = createRpcClient(controller.signal)
    getTxBundle(hash, client)
      // enrichment is best-effort (see enrichBundle): token metadata or pool
      // attribution failing does NOT fail the film — it degrades honestly
      .then((bundle) => enrichBundle(bundle, client))
      .then(({ bundle, degraded }) => {
        if (cancelled) return
        const warnings = [
          degraded.tokenMeta && 'Token metadata unavailable — amounts are shown raw.',
          degraded.poolInfo && 'Pool attribution unavailable — shown as a generic AMM pool.',
        ].filter((w): w is string => Boolean(w))
        setState({ status: 'ready', story: buildStory(bundle), warnings })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        if (error instanceof TxNotFoundError) {
          setState({ status: 'error', message: error.message, retryable: false })
        } else if (error instanceof TxNotMinedError) {
          setState({ status: 'error', message: error.message, retryable: true })
        } else if (error instanceof ReceiptUnavailableError) {
          setState({ status: 'error', message: error.message, retryable: true })
        } else {
          setState({
            status: 'error',
            message: 'RPC fetch failed — public endpoints rate-limit. Try again in a moment.',
            retryable: true,
          })
        }
      })
    return () => {
      cancelled = true
      // actually cancel in-flight network work, don't just ignore the result
      controller.abort()
    }
  }, [chainSlug, hash, validationError, attempt])

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
        <ErrorNotice message={state.message} retryable={state.retryable} onRetry={retry} />
      ) : null}

      {state.status === 'ready' && (
        <>
          {state.warnings.length > 0 && (
            <div
              role="status"
              className="mx-auto mb-4 max-w-xl rounded-lg border border-amber-400/20 bg-amber-400/5 px-4 py-2.5 text-center text-xs text-amber-200/90"
            >
              {state.warnings.join(' ')}
            </div>
          )}
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
    <div role="status" className="flex flex-1 flex-col items-center justify-center gap-4">
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

function ErrorNotice({
  message,
  retryable = false,
  onRetry,
}: {
  message: string
  retryable?: boolean
  onRetry?: () => void
}) {
  return (
    <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <p className="max-w-md break-words px-4 text-sm text-zinc-400">{message}</p>
      <div className="flex gap-2">
        {retryable && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-lg bg-amber-300 px-4 py-2 text-xs font-medium text-zinc-950 transition-colors hover:bg-amber-200"
          >
            Retry
          </button>
        )}
        <Link
          href="/"
          className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs text-zinc-300 transition-colors hover:bg-white/10"
        >
          Back to the lobby
        </Link>
      </div>
    </div>
  )
}
