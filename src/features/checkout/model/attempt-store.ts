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
export const attemptKey = (userId: string) => `kurio.checkout.attempt.${userId}`

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

export interface AttemptStore {
  read(userId: string): CheckoutAttempt | null
  write(attempt: CheckoutAttempt): void
  clear(userId: string): void
}

export function createAttemptStore(area: SafeStorage = localArea): AttemptStore {
  return {
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
    write(attempt) {
      area.set(attemptKey(attempt.userId), JSON.stringify(attempt))
    },
    clear(userId) {
      area.remove(attemptKey(userId))
    },
  }
}

export const attemptStore = createAttemptStore()

export interface PrepareDeps {
  newKey?: () => string
  now?: () => number
}

/**
 * The attempt `pay()` sends (CHK-23): the stored one when the body has the same content, with its
 * key; otherwise a new attempt with a new key. An attempt that already knows its order is returned
 * as is: replaying it yields that order, never another.
 */
export function prepareAttempt(
  existing: CheckoutAttempt | null,
  userId: string,
  body: CreateOrderBody,
  { newKey = () => crypto.randomUUID(), now = () => Date.now() }: PrepareDeps = {},
): CheckoutAttempt {
  const fingerprint = canonicalJson(body)
  if (existing?.userId === userId && (existing.fingerprint === fingerprint || existing.orderId)) {
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
