import { z } from 'zod'

import { EditionId } from './catalog'
import { Eth, IsoDateTime, NftId } from './common'
import { Order } from './orders'

// Realtime events (spec 03 §4, brief §7). Every event carries a stable identity, the affected
// resource, a version and the resource's current live fields (never a delta), so applying only the
// newest event gives the right state and a skipped version is harmless.

export const REALTIME_EVENT_TYPES = ['nft.updated', 'order.updated'] as const

export const NftResourceRef = z.object({ type: z.literal('nft'), id: NftId })
export const OrderResourceRef = z.object({ type: z.literal('order'), id: z.string().min(1) })
export const ResourceRef = z.discriminatedUnion('type', [NftResourceRef, OrderResourceRef])
export type ResourceRef = z.infer<typeof ResourceRef>

/** Price and availability, as the catalog shows them. Absent `previousPrice` means "none". */
export const NftLive = z.object({
  price: Eth,
  previousPrice: Eth.optional(),
  available: z.boolean(),
  editions: z.array(z.object({ id: EditionId, available: z.int().min(0).nullable() })),
})
export type NftLive = z.infer<typeof NftLive>

/** What changes while an order settles. */
export const OrderLive = Order.pick({
  status: true,
  transaction: true,
  declineReason: true,
  settledAt: true,
  updatedAt: true,
})
export type OrderLive = z.infer<typeof OrderLive>

const EVENT_ID = /^evt_[a-z.]+_[A-Za-z0-9_-]+_\d+$/

const base = {
  id: z.string().regex(EVENT_ID, 'Invalid event id.'),
  version: z.int().min(1),
  occurredAt: IsoDateTime,
}

export const NftUpdatedEvent = z.object({
  ...base,
  type: z.literal('nft.updated'),
  resource: NftResourceRef,
  data: NftLive,
})

export const OrderUpdatedEvent = z.object({
  ...base,
  type: z.literal('order.updated'),
  resource: OrderResourceRef,
  data: OrderLive,
})

export const RealtimeEvent = z.discriminatedUnion('type', [NftUpdatedEvent, OrderUpdatedEvent])
export type RealtimeEvent = z.infer<typeof RealtimeEvent>
export type RealtimeEventType = RealtimeEvent['type']
export type EventOf<T extends RealtimeEventType> = Extract<RealtimeEvent, { type: T }>

/**
 * The same change always has the same id: `evt_<type>_<resourceId>_<version>`, so a redelivery
 * is recognizable as a duplicate (RT-05).
 */
export function eventId(type: RealtimeEventType, resourceId: string, version: number): string {
  return `evt_${type}_${resourceId}_${String(version)}`
}

/** `type:id`, the key under which versions are tracked. */
export function resourceKey(resource: ResourceRef): string {
  return `${resource.type}:${resource.id}`
}
