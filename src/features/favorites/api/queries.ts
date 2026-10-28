import { queryOptions } from '@tanstack/react-query'

import { favoritesApi } from '@/api'

import { favoritesKeys } from './keys'

/** One request serves every heart on the page: they all read this entry. */
export const favoritesQuery = () =>
  queryOptions({
    queryKey: favoritesKeys.all,
    queryFn: ({ signal }) => favoritesApi.list({ signal }),
  })
