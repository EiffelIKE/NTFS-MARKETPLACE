import type { QueryClient } from '@tanstack/react-query'
import { createRouter, parseSearchWith, stringifySearchWith } from '@tanstack/react-router'

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
  // Search params stay plain strings (`?q=123`, `?minPrice=0.20`), never JSON: the default
  // serializer would quote numeric-looking text (`?q=%22123%22`) and turn `0.20` into `0.2`.
  // Schemas coerce what they need (spec 05 design §3).
  parseSearch: parseSearchWith((value) => value),
  stringifySearch: stringifySearchWith((value) => JSON.stringify(value)),
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
