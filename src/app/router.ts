import type { QueryClient } from '@tanstack/react-query'
import { createRouter } from '@tanstack/react-router'

import { NotFound, RouteError } from '@/components/route-states'
import { routeTree } from '@/routeTree.gen'

import { queryClient } from './query-client'

export interface RouterContext {
  queryClient: QueryClient
}

export const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  // Query owns freshness.
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
  defaultNotFoundComponent: NotFound,
  defaultErrorComponent: RouteError,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
