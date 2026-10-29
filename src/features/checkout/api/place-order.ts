import { ordersApi } from '@/api'
import type { Order, Quote } from '@/contracts'
import { isSessionError } from '@/lib/http/auth'
import { isApiError, toApiError, type ApiError } from '@/lib/http/errors'

import { attemptStore, type AttemptStore, type CheckoutAttempt } from '../model/attempt-store'

/**
 * What one `orders.create` call came to (spec 09 design §6). The union is closed: every error of
 * the table in the design lands in exactly one member, so the screen decides by `kind` and never
 * by parsing a message.
 */
export type PlaceOutcome =
  /** 201, or 200 for a replay of the same key and body: the order exists (CHK-29). */
  | { kind: 'created'; order: Order }
  /** The user already has this order (CHK-27): follow it instead of showing an error. */
  | { kind: 'tracking'; orderId: string }
  /** `QUOTE_CHANGED`: the API's quote replaces the reviewed one (CHK-20). */
  | { kind: 'quote-changed'; quote: Quote }
  /** `INSUFFICIENT_AVAILABILITY` (CHK-21). */
  | {
      kind: 'unavailable'
      lines: { nftId: string; editionId: string; requested: number; available: number }[]
    }
  /** `WALLET_NOT_CONNECTED` (CHK-16). */
  | { kind: 'wallet-disconnected'; error: ApiError }
  /** `VALIDATION_FAILED` (CHK-08). */
  | { kind: 'invalid'; error: ApiError }
  /** The session is gone; spec 04's flow takes over (CHK-28). */
  | { kind: 'session' }
  /** Timeout, network failure, 5xx or an unreadable answer: the order may exist (CHK-25). */
  | { kind: 'unknown'; error: ApiError }
  /** Any other refusal; nothing was created. */
  | { kind: 'failed'; error: ApiError }

/** Whether the request may have been processed even though no usable answer came back. */
function resultUnknown(error: ApiError): boolean {
  if (error.kind === 'http') return (error.status ?? 0) >= 500
  return true
}

export function classifyPlaceError(failure: unknown): PlaceOutcome {
  if (isSessionError(failure)) return { kind: 'session' }
  const error = toApiError(failure)
  if (isApiError(error, 'QUOTE_CHANGED'))
    return { kind: 'quote-changed', quote: error.details.quote }
  if (isApiError(error, 'INSUFFICIENT_AVAILABILITY')) {
    return { kind: 'unavailable', lines: error.details.lines }
  }
  if (isApiError(error, 'ORDER_PENDING'))
    return { kind: 'tracking', orderId: error.details.orderId }
  if (isApiError(error, 'IDEMPOTENCY_CONFLICT')) {
    return { kind: 'tracking', orderId: error.details.orderId }
  }
  if (isApiError(error, 'WALLET_NOT_CONNECTED')) return { kind: 'wallet-disconnected', error }
  if (isApiError(error, 'VALIDATION_FAILED')) return { kind: 'invalid', error }
  return resultUnknown(error) ? { kind: 'unknown', error } : { kind: 'failed', error }
}

/**
 * Sends one attempt. The attempt is stored first, so the key survives a reload while the request
 * is in flight (CHK-26); the answer then updates it: an order id once known, and `rejected` when
 * the server definitely created nothing. An unknown result leaves it as `sent`, which is what
 * makes the next load replay it. `replay` is that next load asking again with the stored key.
 */
export async function placeOrder(
  attempt: CheckoutAttempt,
  {
    store = attemptStore,
    send = ordersApi.create,
    replay = false,
  }: { store?: AttemptStore; send?: typeof ordersApi.create; replay?: boolean } = {},
): Promise<PlaceOutcome> {
  store.write({ ...attempt, phase: 'sent' })
  try {
    const order = await send(attempt.body, { idempotencyKey: attempt.key })
    store.write({ ...attempt, orderId: order.id, phase: 'sent' })
    return { kind: 'created', order }
  } catch (error) {
    const outcome = classifyPlaceError(error)
    if (outcome.kind === 'tracking') {
      store.write({ ...attempt, orderId: outcome.orderId, phase: 'sent' })
    } else if (outcome.kind === 'session' && replay) {
      // A replay that finds the session gone learned nothing: the first request may have created
      // the order, so the attempt stays recoverable.
    } else if (outcome.kind !== 'unknown') {
      store.write({ ...attempt, phase: 'rejected' })
    }
    return outcome
  }
}
