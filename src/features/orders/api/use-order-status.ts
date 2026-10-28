import { useQuery } from '@tanstack/react-query'

import type { Order } from '@/contracts'

import { orderQueryOptions } from './order-queries'

/** The fallback poll while an order is pending, for a dropped socket or a lost event (CHK-29). */
export const ORDER_POLL_MS = 5_000

/** Polls only while the order can still change; `confirmed` and `declined` are terminal. */
export function orderPollInterval(order: Pick<Order, 'status'> | undefined): number | false {
  return order?.status === 'pending' ? ORDER_POLL_MS : false
}

/** Options for tracking one order: the query plus its pending-only poll. */
export const orderTrackingOptions = (orderId: string) => ({
  ...orderQueryOptions(orderId),
  refetchInterval: (query: { state: { data: Order | undefined } }) =>
    orderPollInterval(query.state.data),
})

export type TrackedStatus = 'loading' | 'error' | Order['status']

/**
 * Follows one order (spec 09 design §7; spec 10 reuses it). Updates arrive through `order.updated`,
 * which spec 03 applies to this query's cache entry behind its version guard; this hook only reads
 * the cache. The poll is the fallback, and a reconnection invalidates the entry (spec 03).
 */
export function useOrderStatus(orderId: string) {
  const query = useQuery(orderTrackingOptions(orderId))
  const status: TrackedStatus = query.data ? query.data.status : query.isError ? 'error' : 'loading'
  return {
    order: query.data,
    status,
    error: query.error,
    refetch: query.refetch,
  }
}
