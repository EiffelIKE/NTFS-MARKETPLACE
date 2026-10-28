import { RealtimeEvent, type RealtimeEventType } from '@/contracts'

import type { Bus, DomainChange } from '../db/bus'
import type { ConfigStore } from '../config'
import type { ConnectionId, Token, UserId } from '../db/state'
import type { Store } from '../db/store'
import { lookupSession } from '../domain/auth'
import { buildEnvelope } from './envelope'
import type { DeliveryLogEntry, RealtimeControl, Transport } from './types'

// The mock Socket.IO server, without any socket code (spec 03 §5). A transport is whatever can
// send an event to one client and close it, so the hub is testable with plain fakes and the
// MSW/Socket.IO wiring stays in `handler.ts`.

interface Connection {
  id: ConnectionId
  transport: Transport
  token: Token | null
  openedAt: number
}

interface Delivered {
  entry: DeliveryLogEntry
  payload: unknown
}

const LOG_SIZE = 200

export interface RealtimeHub extends RealtimeControl {
  attach(transport: Transport): ConnectionId
  /** The client's CONNECT `auth`, or `null` when it could not be read. */
  identify(id: ConnectionId, auth: { token?: unknown } | null): void
  detach(id: ConnectionId): void
  /** False while the scenario or a test blocks realtime. */
  accepting(): boolean
  /** Closes everything when the configuration made realtime unavailable. */
  enforce(): void
  /** Subscribes to the domain bus. Returns the unsubscribe function. */
  start(): () => void
  publish(change: DomainChange): void
  stop(): void
}

interface HubOptions {
  store: Store
  bus: Bus
  config: ConfigStore
}

export function createHub({ store, bus, config }: HubOptions): RealtimeHub {
  const connections = new Map<ConnectionId, Connection>()
  const timers = new Set<ReturnType<typeof setTimeout>>()
  let delivered: Delivered[] = []
  let blocked = false
  let connectionSeq = 0
  let logSeq = 0

  const userOf = (connection: Connection): UserId | null => {
    if (connection.token === null) return null
    const token = connection.token
    const lookup = store.read((state) => lookupSession(state, token, Date.now()))
    return lookup.kind === 'ok' ? lookup.user.id : null
  }

  const record = (
    kind: DeliveryLogEntry['kind'],
    payload: unknown,
    connectionIds: ConnectionId[],
  ) => {
    const parsed = RealtimeEvent.safeParse(payload)
    const known = parsed.success ? parsed.data : null
    const entry: DeliveryLogEntry = {
      seq: ++logSeq,
      at: new Date(Date.now()).toISOString(),
      kind,
      eventId: known?.id ?? '(invalid)',
      type: known?.type ?? '(invalid)',
      resourceId: known?.resource.id ?? '',
      version: known?.version ?? 0,
      connectionIds,
    }
    delivered.push({ entry, payload })
    if (delivered.length > LOG_SIZE) delivered = delivered.slice(-LOG_SIZE)
    return entry
  }

  const send = (ids: ConnectionId[], type: string, payload: unknown) => {
    for (const id of ids) {
      try {
        // The socket event name is the envelope's `type`; an invalid injection keeps whatever
        // name it came with.
        connections.get(id)?.transport.emit(type as RealtimeEventType, payload)
      } catch (error) {
        console.warn('[mock] realtime emit failed', error)
      }
    }
  }

  /** `nft.updated` goes to everyone; `order.updated` only to the owner's valid sessions. */
  const audience = (payload: unknown): ConnectionId[] => {
    const parsed = RealtimeEvent.safeParse(payload)
    const all = [...connections.values()]
    if (!parsed.success || parsed.data.type === 'nft.updated') return all.map((c) => c.id)
    const orderId = parsed.data.resource.id
    const ownerId = store.read((state) => state.orders[orderId]?.userId)
    if (ownerId === undefined) return []
    return all.filter((connection) => userOf(connection) === ownerId).map((c) => c.id)
  }

  const deliver = (payload: unknown) => {
    const ids = audience(payload)
    record('publish', payload, ids)
    const parsed = RealtimeEvent.safeParse(payload)
    if (parsed.success) send(ids, parsed.data.type, payload)
  }

  const hub: RealtimeHub = {
    attach(transport) {
      const id = `conn_${String(++connectionSeq)}`
      connections.set(id, { id, transport, token: null, openedAt: Date.now() })
      return id
    },
    identify(id, auth) {
      const connection = connections.get(id)
      if (!connection) return
      connection.token = typeof auth?.token === 'string' && auth.token ? auth.token : null
    },
    detach(id) {
      connections.delete(id)
    },
    accepting: () => config.effective().realtime.available && !blocked,
    enforce() {
      if (!hub.accepting()) hub.drop()
    },
    start: () =>
      bus.subscribe((change) => {
        hub.publish(change)
      }),
    publish(change) {
      const envelope = store.read((state) => buildEnvelope(change, state, Date.now()))
      if (!envelope) return
      const timer = setTimeout(() => {
        timers.delete(timer)
        deliver(envelope)
      }, config.effective().realtime.deliveryDelayMs)
      // In Node a pending delivery must never keep the process alive.
      ;(timer as { unref?: () => void }).unref?.()
      timers.add(timer)
    },
    stop() {
      for (const timer of timers) clearTimeout(timer)
      timers.clear()
    },

    connections: () =>
      [...connections.values()].map((connection) => ({
        id: connection.id,
        userId: userOf(connection),
        openedAt: new Date(connection.openedAt).toISOString(),
      })),
    drop(opts) {
      if (opts?.block) blocked = true
      const open = [...connections.values()]
      // Forget them first: the transports' own close handlers then find nothing to detach.
      connections.clear()
      for (const connection of open) {
        try {
          connection.transport.close()
        } catch (error) {
          console.warn('[mock] realtime close failed', error)
        }
      }
    },
    restore() {
      blocked = false
    },
    redeliver(count = 1) {
      const last = delivered
        .filter(({ entry }) => entry.kind === 'publish' && entry.connectionIds.length > 0)
        .slice(-count)
      for (const { entry, payload } of last) {
        const live = entry.connectionIds.filter((id) => connections.has(id))
        record('redeliver', payload, live)
        send(live, entry.type, payload)
      }
    },
    inject(event, to) {
      const ids = to?.connectionIds
        ? to.connectionIds.filter((id) => connections.has(id))
        : audience(event)
      record('inject', event, ids)
      const named = typeof event === 'object' && event !== null && 'type' in event
      send(ids, named && typeof event.type === 'string' ? event.type : 'nft.updated', event)
    },
    log: () => delivered.map(({ entry }) => ({ ...entry })),
    clearLog() {
      delivered = []
    },
  }
  return hub
}
