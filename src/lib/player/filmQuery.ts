import { queryOptions } from '@tanstack/react-query'
import { createRpcClient } from '@/lib/chain/client'
import { enrichBundle } from '@/lib/decode/enrich'
import { getTxBundle } from '@/lib/fetch/getTxBundle'
import { buildStory } from '@/lib/story/build'
import type { Story } from '@/lib/story/types'

export type Film = {
  story: Story
  warnings: string[]
}

export const filmQuery = {
  key: (chainSlug: string, hash: string) => ['film', chainSlug, hash.toLowerCase()] as const,
  options: (chainSlug: string, hash: `0x${string}`) =>
    queryOptions({
      queryKey: filmQuery.key(chainSlug, hash),
      queryFn: async ({ signal }): Promise<Film> => {
        const client = createRpcClient(signal)
        const bundle = await getTxBundle(hash, client)
        const { bundle: enriched, degraded } = await enrichBundle(bundle, client)
        const warnings = [
          degraded.tokenMeta && 'Token metadata unavailable — amounts are shown raw.',
          degraded.poolInfo && 'Pool attribution unavailable — shown as a generic AMM pool.',
        ].filter((warning): warning is string => Boolean(warning))

        return { story: buildStory(enriched), warnings }
      },
      // A mined transaction's film is immutable. Keep it ready after a route
      // unmount, but bound inactive cache memory to one browsing session.
      staleTime: Infinity,
      gcTime: 30 * 60 * 1000,
      retry: false,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    }),
}
