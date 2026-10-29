import { keepPreviousData, queryOptions } from '@tanstack/react-query'

import { catalogApi } from '@/api'
import type { NftId, NftListQuery, NftListResponse } from '@/contracts'
import { isRetryable } from '@/lib/http/errors'

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

/** Same transient-failure policy as the app default (spec 00 §6), stated here because the details
 *  route loads this query through the router, which does not apply the client's retry default. */
const retryTransient = (failureCount: number, error: Error) =>
  failureCount < 2 && isRetryable(error)

/**
 * One NFT with its editions and reviews (spec 06). Spec 03's appliers patch this entry on
 * `nft.updated`, so a screen that reads it follows price and stock without a request.
 */
export const nftDetailQuery = (id: NftId) =>
  queryOptions({
    queryKey: catalogKeys.detail(id),
    queryFn: ({ signal }) => catalogApi.get(id, { signal }),
    retry: retryTransient,
  })

/** "Mais desta coleção": up to five related NFTs, loaded apart from the NFT itself (DET-04). */
export const relatedQuery = (id: NftId) =>
  queryOptions({
    queryKey: catalogKeys.related(id),
    queryFn: ({ signal }) => catalogApi.related(id, { signal }),
  })
