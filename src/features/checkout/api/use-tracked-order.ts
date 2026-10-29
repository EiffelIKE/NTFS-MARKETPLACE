import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as React from 'react'

import type { ApiError } from '@/lib/http/errors'
import type { Order, OrderList } from '@/contracts'
import { useAccountUserId } from '@/features/account/model/use-account'
import { useCartOwner } from '@/features/cart/model/use-cart'
import { orderKeys, pendingOrdersQueryOptions } from '@/features/orders/api/order-queries'

import { attemptStore, type CheckoutAttempt } from '../model/attempt-store'
import { applyOutcome } from './use-create-order'
import { placeOrder } from './place-order'

export type TrackedOrder =
  /** The pending list has not answered yet. */
  | { phase: 'loading' }
  /** A stored attempt without an answer is being replayed (CHK-26). */
  | { phase: 'checking' }
  /** The replay could not reach the server: the order may exist (CHK-25). */
  | { phase: 'unknown'; error: ApiError; retry: () => void }
  /** The user has an order to follow: pending, or settled and not yet acknowledged. */
  | { phase: 'order'; orderId: string }
  /** Nothing to follow: the form is next. */
  | { phase: 'none' }

/**
 * Which order checkout is following, if any (spec 09 design §3, §6). In order of precedence: the
 * order just created, the order a stored attempt already knows, the order a replayed attempt turns
 * out to have created, and the user's pending order from the API (CHK-30). A stored attempt that
 * has no answer yet is replayed **once** with its own key and body: the server answers with the
 * order if it exists, so the user never pays twice (CHK-26). `release` drops an order the user has
 * dealt with (a refused payment they retry or leave).
 */
export function useTrackedOrder({ cartEmpty }: { cartEmpty: boolean }) {
  const queryClient = useQueryClient()
  const userId = useAccountUserId()
  const owner = useCartOwner()
  const pending = useQuery(pendingOrdersQueryOptions())
  const [created, setCreated] = React.useState<string | null>(null)
  const [released, setReleased] = React.useState<ReadonlySet<string>>(new Set())

  // What was stored when the page opened: later writes are this page's own and must not re-run it.
  // An attempt older than its TTL is dropped here, so it is neither replayed nor followed (R2). One
  // whose order is already known to be confirmed is dropped too: the user has moved on, and the
  // next purchase must not bounce to the old receipt (R3). Decided once, at mount.
  const [opened] = React.useState(() => {
    const attempt = userId ? attemptStore.readLive(userId) : null
    if (!userId || attempt?.orderId == null) return attempt
    const cached = queryClient.getQueryData<Order>(orderKeys.detail(attempt.orderId))
    if (cached?.status !== 'confirmed') return attempt
    attemptStore.clear(userId)
    return null
  })
  const [late, setLate] = React.useState<CheckoutAttempt | null>(null)
  const unanswered = (attempt: CheckoutAttempt | null) =>
    attempt !== null && attempt.orderId === null && attempt.phase === 'sent' ? attempt : null

  // A lost answer can also happen on this page: the order settles while the review still waits, the
  // cart empties and the form goes away. The attempt is then replayed too, instead of showing
  // "Seu carrinho está vazio" for an order that was paid.
  if (cartEmpty && userId !== undefined && late === null) {
    const found = unanswered(attemptStore.readLive(userId))
    if (found) setLate(found)
  }

  const initial = unanswered(opened) ?? late
  const replayable = initial !== null

  // The replay is identified by the stored attempt's key; the other captured values are handles.
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  const recovery = useQuery({
    queryKey: ['checkout', 'recovery', userId ?? '', initial?.key ?? ''],
    enabled: replayable && userId !== undefined,
    retry: false,
    staleTime: Infinity,
    gcTime: 0,
    queryFn: async () => {
      if (!initial || userId === undefined) return null
      const outcome = await placeOrder(initial, { replay: true })
      applyOutcome(queryClient, owner, userId, outcome)
      switch (outcome.kind) {
        case 'created':
          return outcome.order.id
        case 'tracking':
          return outcome.orderId
        case 'unknown':
          throw outcome.error
        case 'session':
          return null
        default:
          // The order was never created: the attempt is stale, and the form is next.
          attemptStore.clear(userId)
          return null
      }
    },
  })

  const recovered = recovery.data ?? null
  const fromPending = pending.data?.items.find((order) => !released.has(order.id))?.id ?? null
  const candidates = [created, opened?.orderId ?? null, recovered, fromPending]
  const orderId = candidates.find((id): id is string => id !== null && !released.has(id)) ?? null

  const release = React.useCallback(
    (id: string) => {
      setReleased((current) => new Set(current).add(id))
      setCreated((current) => (current === id ? null : current))
      if (userId !== undefined) attemptStore.clear(userId)
      queryClient.setQueryData<OrderList>(orderKeys.pending(), (list) =>
        list ? { items: list.items.filter((order) => order.id !== id) } : list,
      )
      void queryClient.invalidateQueries({ queryKey: orderKeys.pending() })
    },
    [queryClient, userId],
  )

  let state: TrackedOrder
  if (orderId !== null) state = { phase: 'order', orderId }
  else if (replayable && recovery.isError) {
    state = {
      phase: 'unknown',
      error: recovery.error,
      retry: () => {
        void recovery.refetch()
      },
    }
  } else if (replayable && !recovery.isSuccess) state = { phase: 'checking' }
  else if (pending.isPending) state = { phase: 'loading' }
  else state = { phase: 'none' }

  return { state, track: setCreated, release }
}
