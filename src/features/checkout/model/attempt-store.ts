import { z } from 'zod'

import { CreateOrderBody } from '@/contracts'

import { localArea, type SafeStorage } from './safe-storage'

/**
 * One checkout attempt: the idempotency key, the body it was sent with, and what is known of the
 * outcome (spec 09 design §6). It is written **before** the request leaves, so a refresh while the
 * request is in flight still knows the key and can ask the server what happened (CHK-26).
 *
 * `phase`:
 * - `sent`: the request went out and nothing definite came back (still in flight, timeout, network
 *   failure, 5xx). The order may exist. A reload replays the attempt once to find out.
 * - `rejected`: the server answered without creating anything (401, 409, 422). Nothing to recover;
 *   the key stays so the same body keeps the same key.
 */
export const ATTEMPT_PREFIX = 'kurio.checkout.attempt.'
export const attemptKey = (userId: string) => `${ATTEMPT_PREFIX}${userId}`

/**
 * How long an attempt that does not know its order stays recoverable. A reload or a retry within
 * this window replays the attempt (CHK-26); a later visit must not pay on its own, so the attempt
 * is dropped and the form is next. An order the server did create is still found through the
 * pending list (CHK-30).
 */
export const ATTEMPT_TTL_MS = 10 * 60_000

const AttemptSchema = z.object({
  userId: z.string(),
  key: z.string(),
  body: CreateOrderBody,
  fingerprint: z.string(),
  orderId: z.string().nullable(),
  phase: z.enum(['sent', 'rejected']),
  createdAt: z.number(),
})

export type CheckoutAttempt = z.infer<typeof AttemptSchema>

/** JSON with sorted keys, so two bodies with the same content have the same text (CHK-23). */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

/** An attempt with no known order that is older than the TTL (an attempt with an order never is). */
export function isExpired(attempt: CheckoutAttempt, now = Date.now()): boolean {
  return attempt.orderId === null && now - attempt.createdAt > ATTEMPT_TTL_MS
}

export interface AttemptStore {
  read(userId: string): CheckoutAttempt | null
  /** Like `read`, but an expired attempt is removed and reads as `null`. */
  readLive(userId: string, now?: number): CheckoutAttempt | null
  write(attempt: CheckoutAttempt): void
  clear(userId: string): void
  /** Removes the attempts of every user but `userId` (a different person signed in). */
  clearOthers(userId: string): void
}

export function createAttemptStore(area: SafeStorage = localArea): AttemptStore {
  const store: AttemptStore = {
    read(userId) {
      const raw = area.get(attemptKey(userId))
      if (raw === null) return null
      try {
        const parsed = AttemptSchema.safeParse(JSON.parse(raw))
        if (parsed.success && parsed.data.userId === userId) return parsed.data
      } catch {
        // Falls through: an attempt that does not parse is dropped.
      }
      area.remove(attemptKey(userId))
      return null
    },
    readLive(userId, now = Date.now()) {
      const attempt = store.read(userId)
      if (attempt && isExpired(attempt, now)) {
        area.remove(attemptKey(userId))
        return null
      }
      return attempt
    },
    write(attempt) {
      area.set(attemptKey(attempt.userId), JSON.stringify(attempt))
    },
    clear(userId) {
      area.remove(attemptKey(userId))
    },
    clearOthers(userId) {
      for (const key of area.keys(ATTEMPT_PREFIX)) {
        if (key !== attemptKey(userId)) area.remove(key)
      }
    },
  }
  return store
}

export const attemptStore = createAttemptStore()

/**
 * Forgets the attempt once the order it created has settled and the user has seen it, so the next
 * purchase starts clean instead of being sent back to the old order. Only an attempt that knows
 * this order is touched; one still waiting for its answer is the replay's to resolve.
 */
export function forgetSettledAttempt(
  store: AttemptStore,
  userId: string,
  order: { id: string; status: 'pending' | 'confirmed' | 'declined' },
): void {
  if (order.status === 'pending') return
  if (store.read(userId)?.orderId === order.id) store.clear(userId)
}

export interface PrepareDeps {
  newKey?: () => string
  now?: () => number
}

/**
 * The attempt `pay()` sends (CHK-23): the stored one when the body has the same content, with its
 * key; otherwise a new attempt with a new key. An attempt that already knows its order is returned
 * as is: replaying it yields that order, never another. An expired attempt is not reused: if its
 * order exists, the server answers the new key with `ORDER_PENDING` and checkout follows it.
 */
export function prepareAttempt(
  existing: CheckoutAttempt | null,
  userId: string,
  body: CreateOrderBody,
  { newKey = () => crypto.randomUUID(), now = () => Date.now() }: PrepareDeps = {},
): CheckoutAttempt {
  const fingerprint = canonicalJson(body)
  if (
    existing?.userId === userId &&
    (existing.orderId || (existing.fingerprint === fingerprint && !isExpired(existing, now())))
  ) {
    return existing
  }
  return {
    userId,
    key: newKey(),
    body,
    fingerprint,
    orderId: null,
    phase: 'sent',
    createdAt: now(),
  }
}
