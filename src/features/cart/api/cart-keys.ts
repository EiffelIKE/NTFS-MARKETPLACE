import type { SessionOwner } from '@/features/auth/model/session'

/** Whose cart a cache entry holds: a user's, or the guest's. */
export type CartOwner = SessionOwner

export const ownerKey = (owner: CartOwner): string =>
  owner.kind === 'user' ? `user:${owner.userId}` : 'guest'

/**
 * Cart query keys (spec 07 design §3). The owner is part of every key, so a cart never shows up for
 * another identity even before the cache is cleared on a user switch. Spec 07 adds `quote`.
 */
export const cartKeys = {
  all: ['cart'] as const,
  detail: (owner: CartOwner) => ['cart', ownerKey(owner)] as const,
}
