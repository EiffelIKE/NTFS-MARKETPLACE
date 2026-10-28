import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { useEffect } from 'react'

import { realtime } from '@/lib/realtime'

import { Devtools } from './devtools'
import { queryClient } from './query-client'
import { router } from './router'

/** Runs `task` when the browser is idle (at most 2 s later), so it never competes with paint. */
function whenIdle(task: () => void): () => void {
  if (typeof requestIdleCallback === 'function') {
    const id = requestIdleCallback(task, { timeout: 2000 })
    return () => {
      cancelIdleCallback(id)
    }
  }
  const id = setTimeout(task, 200)
  return () => {
    clearTimeout(id)
  }
}

export function App() {
  // One socket per tab for the life of the app (spec 03, RT-19). It loads after the first render.
  useEffect(() => {
    const cancel = whenIdle(() => {
      realtime.start({ queryClient })
    })
    return () => {
      cancel()
      realtime.stop()
    }
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Devtools />
    </QueryClientProvider>
  )
}
