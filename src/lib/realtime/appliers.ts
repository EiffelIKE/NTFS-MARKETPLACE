import type { QueryClient, QueryKey } from '@tanstack/react-query'

import type { EventOf, NftLive, RealtimeEvent, ResourceRef } from '@/contracts'

// Default cache appliers (spec 03 §7). Events carry live fields, so the cache is patched in place
// with no refetch. Only entries older than the event are touched, which makes every applier
// idempotent and unable to revert newer data (RT-12, RT-13, RT-14).
//
// Query key contract, relied on by specs 05, 06 and 09:
//   ['nfts', ...]              NftSummary, NftDetail or { items: NftSummary[] }
//   ['orders', 'detail', id]   Order
//   other ['orders', ...]      order lists

interface Versioned {
  id: string
  version: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isVersioned(value: unknown, id: string): value is Versioned & Record<string, unknown> {
  return isRecord(value) && value.id === id && typeof value.version === 'number'
}

function itemsOf(value: unknown): unknown[] | null {
  return isRecord(value) && Array.isArray(value.items) ? (value.items as unknown[]) : null
}

/** The highest version of the resource among cached queries, or `null` when none is cached. */
export function cachedVersion(queryClient: QueryClient, resource: ResourceRef): number | null {
  const { type, id } = resource
  let highest: number | null = null
  const note = (value: unknown) => {
    if (isVersioned(value, id)) highest = Math.max(highest ?? 0, value.version)
  }
  if (type === 'nft') {
    for (const [, data] of queryClient.getQueriesData({ queryKey: ['nfts'] })) {
      note(data)
      itemsOf(data)?.forEach(note)
    }
  } else {
    note(queryClient.getQueryData(['orders', 'detail', id]))
  }
  return highest
}

function patchNft<T>(value: T, event: EventOf<'nft.updated'>): T {
  const { id } = event.resource
  const items = itemsOf(value)
  if (items) {
    const next = items.map((item) => patchNft(item, event))
    return next.some((item, index) => item !== items[index])
      ? ({ ...(value as object), items: next } as T)
      : value
  }
  if (!isVersioned(value, id) || value.version >= event.version) return value

  const rest: Record<string, unknown> = { ...value }
  delete rest.previousPrice
  const live: NftLive = event.data
  const editions = Array.isArray(rest.editions)
    ? (rest.editions as { id: string; available: number | null }[]).map((edition) => {
        const update = live.editions.find((e) => e.id === edition.id)
        return update ? { ...edition, available: update.available } : edition
      })
    : undefined
  return {
    ...rest,
    price: live.price,
    ...(live.previousPrice !== undefined && { previousPrice: live.previousPrice }),
    available: live.available,
    version: event.version,
    ...(editions && { editions }),
  } as T
}

/** Writes `next` over `key` without making the entry look freshly fetched. */
function patchQueries(
  queryClient: QueryClient,
  keys: { queryKey: QueryKey },
  patch: (value: unknown) => unknown,
): void {
  for (const [queryKey, data] of queryClient.getQueriesData(keys)) {
    const next = patch(data)
    if (next === data) continue
    queryClient.setQueryData(queryKey, next, {
      updatedAt: queryClient.getQueryState(queryKey)?.dataUpdatedAt ?? Date.now(),
    })
  }
}

export function applyNftUpdated(queryClient: QueryClient, event: EventOf<'nft.updated'>): void {
  patchQueries(queryClient, { queryKey: ['nfts'] }, (value) => patchNft(value, event))
  // A list sorted or faceted by price may now be wrong: stale, but no refetch flicker.
  void queryClient.invalidateQueries({ queryKey: ['nfts', 'list'], refetchType: 'none' })
}

export function applyOrderUpdated(queryClient: QueryClient, event: EventOf<'order.updated'>): void {
  const { id } = event.resource
  const key = ['orders', 'detail', id] as const
  const order = queryClient.getQueryData(key)
  const isList = (queryKey: QueryKey) => queryKey[1] !== 'detail'
  const listed = queryClient
    .getQueriesData({ queryKey: ['orders'], predicate: (query) => isList(query.queryKey) })
    .some(([, data]) => itemsOf(data)?.some((item) => isRecord(item) && item.id === id))

  // An order that is nowhere in the cache changes nothing.
  if (order === undefined && !listed) return

  if (isVersioned(order, id) && order.version < event.version) {
    queryClient.setQueryData(
      key,
      { ...order, ...event.data, version: event.version },
      { updatedAt: queryClient.getQueryState(key)?.dataUpdatedAt ?? Date.now() },
    )
  }
  void queryClient.invalidateQueries({
    queryKey: ['orders'],
    predicate: (query) => isList(query.queryKey),
  })
}

export function applyEvent(queryClient: QueryClient, event: RealtimeEvent): void {
  if (event.type === 'nft.updated') applyNftUpdated(queryClient, event)
  else applyOrderUpdated(queryClient, event)
}
