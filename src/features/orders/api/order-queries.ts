import { queryOptions } from '@tanstack/react-query'

import { ordersApi } from '@/api'
import type { Order } from '@/contracts'

/**
 * Order query keys. The first two segments are a contract with spec 03's `order.updated` applier:
 * `['orders', 'detail', id]` is patched in place, every other `['orders', ...]` entry is a list.
 * No user in the key: orders are fetched with the bearer (another user's is a 403), and the whole
 * cache is cleared on sign-out and user switch (spec 04).
 */
export const orderKeys = {
  all: ['orders'] as const,
  /** Every list of orders; a settled order moves between them. */
  lists: ['orders', 'list'] as const,
  detail: (orderId: string) => ['orders', 'detail', orderId] as const,
  pending: () => ['orders', 'list', { status: 'pending' }] as const,
}

/**
 * One order. A response older than the cached order (a poll that was in flight while an event
 * settled it) is dropped in favor of the cache, so `confirmed` and `declined` are never undone
 * (CHK-33).
 */
export const orderQueryOptions = (orderId: string) =>
  queryOptions({
    queryKey: orderKeys.detail(orderId),
    queryFn: async ({ signal, client }): Promise<Order> => {
      const order = await ordersApi.get(orderId, { signal })
      const cached = client.getQueryData<Order>(orderKeys.detail(orderId))
      return cached && order.version < cached.version ? cached : order
    },
    staleTime: 30_000,
  })

/** The user's pending orders: the checkout gate (CHK-30). Fresh on every visit. */
export const pendingOrdersQueryOptions = () =>
  queryOptions({
    queryKey: orderKeys.pending(),
    queryFn: ({ signal }) => ordersApi.list({ status: 'pending' }, { signal }),
    staleTime: 5_000,
  })
