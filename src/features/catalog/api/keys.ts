import type { NftId, NftListQuery } from '@/contracts'

/**
 * Catalog query keys. Spec 03's cache appliers patch everything under `['nfts']` and spec 06 adds
 * its details and favorites invalidation, so the prefixes here are a contract.
 */
export const catalogKeys = {
  all: ['nfts'] as const,
  lists: () => [...catalogKeys.all, 'list'] as const,
  list: (query: NftListQuery) => [...catalogKeys.lists(), query] as const,
  details: () => [...catalogKeys.all, 'detail'] as const,
  detail: (id: NftId) => [...catalogKeys.details(), id] as const,
  related: (id: NftId) => [...catalogKeys.all, 'related', id] as const,
  highlights: ['highlights'] as const,
}
