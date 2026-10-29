import { eventId, type NftLive, type OrderLive, type RealtimeEvent } from '@/contracts'

import type { DomainChange } from '../db/bus'
import type { MockState, NftRecord, OrderRecord } from '../db/state'
import { toNftSummary, toOrder } from '../domain/mappers'

// Domain change + committed state -> wire event (spec 03 §5). The live fields come from the same
// mappers REST uses, so an event and the next GET can never disagree (brief §6).

export function nftLive(nft: NftRecord): NftLive {
  const summary = toNftSummary(nft)
  return {
    price: summary.price,
    ...(summary.previousPrice !== undefined && { previousPrice: summary.previousPrice }),
    available: summary.available,
    editions: nft.editions.map(({ id, available }) => ({ id, available })),
  }
}

export function orderLive(order: OrderRecord): OrderLive {
  const { status, transaction, declineReason, settledAt, updatedAt } = toOrder(order)
  return { status, transaction, declineReason, settledAt, updatedAt }
}

/**
 * Builds the envelope for a change, or `null` when the resource is gone or a later change in the
 * same write already carries a newer version. In that case the later change produces the only
 * event, with the final state.
 */
export function buildEnvelope(
  change: DomainChange,
  state: Readonly<MockState>,
  now: number,
): RealtimeEvent | null {
  const occurredAt = new Date(now).toISOString()
  if (change.type === 'nft.updated') {
    const nft = state.nfts[change.nftId]
    if (nft?.version !== change.version) return null
    return {
      id: eventId(change.type, nft.id, nft.version),
      type: change.type,
      resource: { type: 'nft', id: nft.id },
      version: nft.version,
      occurredAt,
      data: nftLive(nft),
    }
  }
  const order = state.orders[change.orderId]
  if (order?.version !== change.version) return null
  return {
    id: eventId(change.type, order.id, order.version),
    type: change.type,
    resource: { type: 'order', id: order.id },
    version: order.version,
    occurredAt,
    data: orderLive(order),
  }
}
