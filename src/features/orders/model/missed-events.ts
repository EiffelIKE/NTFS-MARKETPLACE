import type { QueryClient } from '@tanstack/react-query'

import { orderKeys } from '../api/order-queries'

// An `order.updated` can arrive before the `orders.create` response that makes the order known to
// the cache. Spec 03's applier then has nothing to patch, but its guard still counts the version,
// so the response (older) would show "pending" until the 5 s poll (R7). The version is remembered
// here, and `recordOrder` refetches the order only when the response turns out to be older.

const missed = new Map<string, number>()

/** Notes an event that found no order in the cache. Call after the default applier has run. */
export function noteOrderEvent(queryClient: QueryClient, orderId: string, version: number): void {
  if (queryClient.getQueryData(orderKeys.detail(orderId)) !== undefined) return
  missed.set(orderId, Math.max(version, missed.get(orderId) ?? 0))
}

/** Whether an event newer than `version` was missed for this order. Forgets it either way. */
export function takeMissedNewerEvent(orderId: string, version: number): boolean {
  const seen = missed.get(orderId)
  missed.delete(orderId)
  return seen !== undefined && seen > version
}

export function forgetMissedEvents(): void {
  missed.clear()
}
