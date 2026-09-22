'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { isHash } from 'viem'
import { Stage } from '@/components/stage/Stage'
import { getChainConfig } from '@/lib/chain/chains'
import {
  ReceiptUnavailableError,
  TxNotMinedError,
  TxNotFoundError,
} from '@/lib/fetch/getTxBundle'
import { filmQuery } from '@/lib/player/filmQuery'

// Client-side only: the browser talks to RPC endpoints directly (same-origin
// proxy first when deployed with one). No wallet, no indexing APIs.
export function PlayerScreen({ chainSlug, hash }: { chainSlug: string; hash: string }) {
  // input validation is synchronous — derive it during render, not in an effect
  const validationError = !getChainConfig(chainSlug)
    ? 'V1 plays Ethereum mainnet only — try /play/eth/<hash>.'
    : !isHash(hash)
      ? 'That does not look like a transaction hash (0x followed by 64 hex chars).'
      : null

  const query = useQuery({
    ...filmQuery.options(chainSlug, hash as `0x${string}`),
    enabled: validationError === null,
  })
  const error = query.error ? describeError(query.error) : null

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
      ) : query.isPending ? (
        <LoadingFilm />
      ) : query.isError && error ? (
        <ErrorNotice
          message={error.message}
          retryable={error.retryable}
          onRetry={() => void query.refetch()}
        />
      ) : null}

      {query.data && (
        <>
          {query.data.warnings.length > 0 && (
            <div
              role="status"
              className="mx-auto mb-4 max-w-xl rounded-lg border border-amber-400/20 bg-amber-400/5 px-4 py-2.5 text-center text-xs text-amber-200/90"
            >
              {query.data.warnings.join(' ')}
            </div>
          )}
          <div className="mb-5 text-center">
            <h1 className="text-lg font-medium text-zinc-100">{query.data.story.title}</h1>
            <p className="mt-1 text-sm text-zinc-500">{query.data.story.synopsis}</p>
          </div>
          <Stage story={query.data.story} />
        </>
      )}
    </main>
  )
}

function describeError(error: unknown) {
  if (error instanceof TxNotFoundError) return { message: error.message, retryable: false }
  if (error instanceof TxNotMinedError || error instanceof ReceiptUnavailableError) {
    return { message: error.message, retryable: true }
  }
  return {
    message: 'RPC fetch failed — public endpoints rate-limit. Try again in a moment.',
    retryable: true,
  }
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
