import { MotionConfig } from 'framer-motion'
import type { ReactNode } from 'react'
import { PlayProviders } from './providers'

export default function PlayLayout({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <PlayProviders>{children}</PlayProviders>
    </MotionConfig>
  )
}
