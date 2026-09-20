'use client'

import Link from 'next/link'
import { useEffect } from 'react'

const BTN =
  'rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs text-zinc-300 transition-colors hover:bg-white/10'

// Route-level crash fallback. The film pipeline catches its own RPC failures
// (PlayerScreen) — this only fires on a genuine render bug. This Next version
// passes a `retry` prop for re-rendering the segment.
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-[11px] tracking-[0.45em] text-amber-200/70 uppercase">
        projection failure
      </p>
      <h1 className="text-lg font-medium text-zinc-100">Something broke mid-reel.</h1>
      <p className="max-w-md text-sm text-zinc-500">
        {error.message || 'An unexpected error interrupted the screening.'}
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={retry}
          className="rounded-lg bg-amber-300 px-4 py-2 text-xs font-medium text-zinc-950 transition-colors hover:bg-amber-200"
        >
          Try again
        </button>
        <Link href="/" className={BTN}>
          Back to the lobby
        </Link>
      </div>
    </main>
  )
}
