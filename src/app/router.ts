import type { QueryClient } from '@tanstack/react-query'
import { createRouter } from '@tanstack/react-router'

import { NotFound, RouteError } from '@/components/route-states'
import { session } from '@/features/auth/model/instance'
import type { SessionController } from '@/features/auth/model/session'
import { routeTree } from '@/routeTree.gen'

import { queryClient } from './query-client'

export interface RouterContext {
  queryClient: QueryClient
  session: SessionController
}

export const router = createRouter({
  routeTree,
  context: { queryClient, session },
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
