import type { Metadata } from 'next'
import { PlayerScreen } from '@/components/player/PlayerScreen'

function shorten(hash: string): string {
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`
}

type Props = PageProps<'/play/[chain]/[hash]'>

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { hash } = await params
  return { title: `Transaction Cinema · ${shorten(hash)}` }
}

// Server shell: reads route params, hands them to the client player.
// The browser does all fetching — this page renders instantly.
// The key remounts the player when the params change, so a same-route
// navigation can never inherit the previous film's state.
export default async function PlayPage({ params }: Props) {
  const { chain, hash } = await params
  return <PlayerScreen key={`${chain}:${hash}`} chainSlug={chain} hash={hash} />
}
