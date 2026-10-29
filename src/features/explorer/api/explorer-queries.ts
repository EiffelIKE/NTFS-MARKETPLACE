import { queryOptions } from '@tanstack/react-query'

import { explorerApi } from '@/api'
import type { NetworkId } from '@/contracts'

export const explorerKeys = {
  tx: (network: NetworkId, hash: string) => ['explorer', 'tx', network, hash] as const,
}

/** A transaction never changes once recorded, so the cache entry stays fresh for good. */
export const explorerTxQuery = (network: NetworkId, hash: string) =>
  queryOptions({
    queryKey: explorerKeys.tx(network, hash),
    queryFn: ({ signal }) => explorerApi.getTransaction(network, hash, { signal }),
    staleTime: Infinity,
  })
