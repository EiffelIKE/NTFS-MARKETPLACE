import type { RealtimeEventType } from '@/contracts'

import type { ConnectionId, UserId } from '../db/state'

// Types shared by the hub, the handler and `window.__mock.realtime`. Kept free of runtime imports
// so the E2E helpers can import them (the Node project has no Vite types).

export interface Transport {
  emit(type: RealtimeEventType, payload: unknown): void
  close(): void
}

export interface ConnectionInfo {
  id: ConnectionId
  /** Resolved from the token now: `null` for a guest or an expired session. */
  userId: UserId | null
  openedAt: string
}

export interface DeliveryLogEntry {
  seq: number
  at: string
  kind: 'publish' | 'redeliver' | 'inject'
  eventId: string
  type: string
  resourceId: string
  version: number
  /** Empty when nobody was entitled to the event, which is how tests prove isolation. */
  connectionIds: ConnectionId[]
}

export interface InjectTarget {
  connectionIds?: ConnectionId[]
}

/** `window.__mock.realtime` (spec 03 §5). */
export interface RealtimeControl {
  connections(): ConnectionInfo[]
  /** Closes every connection. With `block`, reconnections are refused until `restore()`. */
  drop(opts?: { block?: boolean }): void
  restore(): void
  /** Re-sends the last `count` delivered envelopes to the connections that got them first. */
  redeliver(count?: number): void
  /** Sends any payload, valid or not. By default it follows the normal audience rules. */
  inject(event: unknown, to?: InjectTarget): void
  log(): DeliveryLogEntry[]
  clearLog(): void
}
