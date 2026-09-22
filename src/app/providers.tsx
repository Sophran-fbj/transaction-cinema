'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

let browserQueryClient: QueryClient | undefined

function getQueryClient() {
  // A single browser client keeps film queries alive while the user moves
  // between the lobby and a play route. Server renders stay isolated.
  if (typeof window === 'undefined') return new QueryClient()
  browserQueryClient ??= new QueryClient()
  return browserQueryClient
}

export function Providers({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={getQueryClient()}>{children}</QueryClientProvider>
}
