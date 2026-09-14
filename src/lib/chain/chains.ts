import type { Chain } from 'viem'
import { mainnet } from 'viem/chains'

export interface ChainConfig {
  viem: Chain
  slug: string
  label: string
}

// V1 plays Ethereum mainnet only. The /play/[chain]/[hash] route is
// multi-chain shaped so URLs stay stable when more chains arrive.
export const SUPPORTED_CHAINS: Record<string, ChainConfig> = {
  eth: { viem: mainnet, slug: 'eth', label: 'Ethereum' },
}

export function getChainConfig(slug: string): ChainConfig | undefined {
  return SUPPORTED_CHAINS[slug]
}
