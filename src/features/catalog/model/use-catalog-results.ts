import { useQuery } from '@tanstack/react-query'
import * as React from 'react'

import type { NftListResponse } from '@/contracts'

import { nftListQuery } from '../api/queries'
import { toListQuery, type CatalogSearch } from './search'

/**
 * The results for the URL state (CAT-15, CAT-16). `data` belongs to the current key, or to the
 * previous one while the current one loads (`isPlaceholderData`). When the current key fails, the
 * last results that were shown stay available as `stale`, so the alert can sit above them
 * (CAT-18). A response for a key the user has left lands in that key's own entry and is never read.
 */
export function useCatalogResults(search: CatalogSearch) {
  const query = React.useMemo(() => toListQuery(search), [search])
  const result = useQuery(nftListQuery(query))

  const [lastShown, setLastShown] = React.useState<NftListResponse | undefined>()
  if (result.data && lastShown !== result.data) setLastShown(result.data)

  return {
    data: result.data,
    isPending: result.isPending,
    isError: result.isError,
    error: result.error,
    isPlaceholderData: result.isPlaceholderData,
    refetch: result.refetch,
    query,
    /** What the grid shows: current data, else the last data that was shown. */
    shown: result.data ?? lastShown,
    /** The grid shows results of an earlier state: loading the next one, or it failed. */
    isOutdated: result.isPlaceholderData || (result.isError && result.data === undefined),
  }
}
