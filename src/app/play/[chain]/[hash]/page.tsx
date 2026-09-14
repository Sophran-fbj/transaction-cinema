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
export default async function PlayPage({ params }: Props) {
  const { chain, hash } = await params
  return <PlayerScreen chainSlug={chain} hash={hash} />
}
