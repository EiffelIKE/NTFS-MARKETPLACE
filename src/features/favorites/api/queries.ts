import { queryOptions } from '@tanstack/react-query'

import { favoritesApi } from '@/api'

import { withPendingIntents } from './favorites-cache'
import { favoritesKeys } from './keys'

/**
 * One request serves every heart on the page: they all read this entry. A list that comes back
 * while toggles are still on their way carries those toggles, so a read that left before they
 * reached the server never undoes what the user just asked for (F1).
 */
export const favoritesQuery = (userId: string) =>
  queryOptions({
    queryKey: favoritesKeys.list(userId),
    queryFn: async ({ signal, client }) =>
      withPendingIntents(client, await favoritesApi.list({ signal })),
  })
