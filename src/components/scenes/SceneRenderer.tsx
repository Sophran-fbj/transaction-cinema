'use client'

import type { Actor, Scene, StoryFacts } from '@/lib/story/types'
import { ApprovalScene } from './ApprovalScene'
import { GasScene } from './GasScene'
import { OpeningScene } from './OpeningScene'
import { OutroScene } from './OutroScene'
import { RevertScene } from './RevertScene'
import { SwapV2Scene } from './SwapV2Scene'
import { SwapV3Scene } from './SwapV3Scene'
import { TransferScene } from './TransferScene'

// The renderer only knows Scene types — never transaction types. This switch
// is exhaustive: adding a scene variant without a case fails the typecheck.
export function SceneRenderer({
  scene,
  cast,
  facts,
  status,
  txHash,
  onReplay,
}: {
  scene: Scene
  cast: Record<string, Actor>
  facts: StoryFacts
  status: 'success' | 'reverted'
  txHash: `0x${string}`
  onReplay: () => void
}) {
  switch (scene.type) {
    case 'opening':
      return <OpeningScene facts={facts} txHash={txHash} />
    case 'transfer':
      return <TransferScene scene={scene} cast={cast} />
    case 'approval':
      return <ApprovalScene scene={scene} cast={cast} />
    case 'revert':
      return <RevertScene scene={scene} cast={cast} />
    case 'swapV2':
      return <SwapV2Scene scene={scene} cast={cast} />
    case 'swapV3':
      return <SwapV3Scene scene={scene} cast={cast} />
    case 'gas':
      return <GasScene scene={scene} />
    case 'outro':
      return <OutroScene facts={facts} status={status} txHash={txHash} onReplay={onReplay} />
  }
}
