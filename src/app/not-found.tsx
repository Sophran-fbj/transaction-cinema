import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-[11px] tracking-[0.45em] text-amber-200/70 uppercase">empty screen</p>
      <h1 className="text-lg font-medium text-zinc-100">This reel does not exist.</h1>
      <p className="max-w-md text-sm text-zinc-500">
        The address you followed leads to no screening room.
      </p>
      <Link
        href="/"
        className="mt-3 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs text-zinc-300 transition-colors hover:bg-white/10"
      >
        Back to the lobby
      </Link>
    </main>
  )
}
