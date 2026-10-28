import { keepPreviousData, queryOptions } from '@tanstack/react-query'

import { catalogApi } from '@/api'
import type { NftListQuery, NftListResponse } from '@/contracts'

import { catalogKeys } from './keys'

/** The server echoes what it applied; a different echo means the key and the request disagree. */
export function isAppliedQuery(query: NftListQuery, response: NftListResponse): boolean {
  const { applied } = response
  return (
    JSON.stringify([
      applied.q,
      applied.categories,
      applied.networks,
      applied.minPrice,
      applied.maxPrice,
      applied.segment,
      applied.sort,
      applied.favorites,
      applied.page,
      applied.pageSize,
    ]) ===
    JSON.stringify([
      query.q,
      query.categories,
      query.networks,
      query.minPrice,
      query.maxPrice,
      query.segment,
      query.sort,
      query.favorites,
      query.page,
      query.pageSize,
    ])
  )
}

/**
 * One cache entry per URL state (CAT-06). The query function forwards `signal`, so a state the user
 * has left loses its observer and its request is aborted (CAT-16). `keepPreviousData` shows the
 * previous results, dimmed, while the next state loads (CAT-15).
 */
export const nftListQuery = (query: NftListQuery) =>
  queryOptions({
    queryKey: catalogKeys.list(query),
    queryFn: async ({ signal }) => {
      const response = await catalogApi.list(query, { signal })
      // Development guard: catches a key built from something other than the request.
      if (import.meta.env.DEV && !isAppliedQuery(query, response)) {
        console.error('nfts.list applied a different query than the one requested', {
          query,
          applied: response.applied,
        })
      }
      return response
    },
    placeholderData: keepPreviousData,
  })

export const highlightsQuery = () =>
  queryOptions({
    queryKey: catalogKeys.highlights,
    queryFn: ({ signal }) => catalogApi.highlights({ signal }),
  })
