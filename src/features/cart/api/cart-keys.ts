import type { NetworkId } from '@/contracts'
import type { SessionOwner } from '@/features/auth/model/session'

/** Whose cart a cache entry holds: a user's, or the guest's. */
export type CartOwner = SessionOwner

export const ownerKey = (owner: CartOwner): string =>
  owner.kind === 'user' ? `user:${owner.userId}` : 'guest'

/**
 * Cart query keys (spec 07 design §3). The owner is part of every key, so a cart never shows up for
 * another identity even before the cache is cleared on a user switch. The quote is a child of the
 * cart entry and carries the cart `version`: a cart write opens a new quote entry, and an older
 * quote response can only land in an older key. Invalidating `detail` refreshes both.
 */
export const cartKeys = {
  all: ['cart'] as const,
  detail: (owner: CartOwner) => ['cart', ownerKey(owner)] as const,
  quote: (owner: CartOwner, network: NetworkId, version: number) =>
    ['cart', ownerKey(owner), 'quote', network, version] as const,
}
