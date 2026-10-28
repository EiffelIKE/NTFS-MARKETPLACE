import { QueryClient } from '@tanstack/react-query'

import { isRetryable, type ApiError } from '@/lib/http/errors'

declare module '@tanstack/react-query' {
  interface Register {
    defaultError: ApiError
  }
}

// Baseline cache policy (spec 00 design §6). Specs may override per query.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => failureCount < 2 && isRetryable(error),
    },
    mutations: {
      retry: 0,
    },
  },
})
