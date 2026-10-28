import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'

import { Devtools } from './devtools'
import { queryClient } from './query-client'
import { router } from './router'

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Devtools />
    </QueryClientProvider>
  )
}
