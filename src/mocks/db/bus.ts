import type { NftId } from '@/contracts'

import type { OrderId, UserId } from './state'

/** A committed domain change. Spec 03 forwards these over Socket.IO (API-37). */
export type DomainChange =
  | { type: 'nft.updated'; nftId: NftId; version: number }
  | { type: 'order.updated'; orderId: OrderId; userId: UserId; version: number }

export interface Bus {
  publish(change: DomainChange): void
  /** Returns the unsubscribe function. */
  subscribe(listener: (change: DomainChange) => void): () => void
}

export function createBus(): Bus {
  const listeners = new Set<(change: DomainChange) => void>()
  return {
    publish(change) {
      for (const listener of [...listeners]) {
        try {
          listener(change)
        } catch (error) {
          // A broken subscriber must not break the write that already committed.
          console.error('[mock] bus listener failed', error)
        }
      }
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
