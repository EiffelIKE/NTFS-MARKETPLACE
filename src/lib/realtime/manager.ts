import type { QueryClient } from '@tanstack/react-query'

import {
  REALTIME_EVENT_TYPES,
  RealtimeEvent,
  type EventOf,
  type RealtimeEventType,
  type ResourceRef,
} from '@/contracts'

import { applyEvent, cachedVersion } from './appliers'
import { createGuard, type EventGuard } from './guard'
import { createSocket, type SocketFactory, type SocketLike } from './socket'

export type RealtimeStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected'

export interface RealtimeSession {
  /** Identity of the session; a different key or token means a new socket. */
  key: string
  token: string | null
}

export type EventOutcome = 'applied' | 'duplicate' | 'stale' | 'invalid'

export interface EventLogEntry {
  seq: number
  eventId: string
  type: string
  resource: string
  version: number
  outcome: EventOutcome
}

const LOG_SIZE = 50

type Listener<T extends RealtimeEventType> = (event: EventOf<T>) => void

export interface RealtimeManager {
  /** Lets the manager connect once a session is set. Call after the first render. */
  start(deps: { queryClient: QueryClient }): void
  /** Closes the socket and forgets the Query client. */
  stop(): void
  /** Opens a fresh socket for this identity, closing the previous one first (RT-18). */
  setSession(session: RealtimeSession): void
  status: () => RealtimeStatus
  subscribeStatus: (listener: () => void) => () => void
  /** Listens to events that passed the guards, after the default applier. Returns the remover. */
  on<T extends RealtimeEventType>(type: T, listener: Listener<T>): () => void
  /** The last events with what happened to each, newest last (`/dev/realtime`). */
  eventLog: () => readonly EventLogEntry[]
  subscribeEventLog: (listener: () => void) => () => void
}

interface ManagerOptions {
  createSocket?: SocketFactory
  guard?: EventGuard
}

export function createRealtimeManager(options: ManagerOptions = {}): RealtimeManager {
  const makeSocket = options.createSocket ?? createSocket
  const guard = options.guard ?? createGuard()

  let queryClient: QueryClient | null = null
  let session: RealtimeSession | null = null
  let socket: SocketLike | null = null
  /** Bumped on every (re)open, so a socket that finished loading too late is discarded. */
  let generation = 0
  let status: RealtimeStatus = 'disconnected'
  let log: readonly EventLogEntry[] = []
  let logSeq = 0

  const statusListeners = new Set<() => void>()
  const logListeners = new Set<() => void>()
  const eventListeners = new Map<RealtimeEventType, Set<(event: never) => void>>()

  const setStatus = (next: RealtimeStatus) => {
    if (status === next) return
    status = next
    for (const listener of [...statusListeners]) listener()
  }

  const record = (
    outcome: EventOutcome,
    entry: Pick<EventLogEntry, 'eventId' | 'type' | 'resource' | 'version'>,
  ) => {
    log = [...log, { seq: ++logSeq, outcome, ...entry }].slice(-LOG_SIZE)
    for (const listener of [...logListeners]) listener()
  }

  const describe = (resource: ResourceRef) => `${resource.type}:${resource.id}`

  /** The processing pipeline of design §6, for one packet from one socket. */
  const receive = (from: SocketLike, type: RealtimeEventType, payload: unknown) => {
    // A packet already queued on a socket that was replaced belongs to the previous session.
    if (from !== socket || !queryClient) return

    const parsed = RealtimeEvent.safeParse(payload)
    if (!parsed.success || parsed.data.type !== type) {
      if (import.meta.env.DEV) console.warn('[realtime] dropped an invalid event', type, payload)
      record('invalid', { eventId: '', type, resource: '', version: 0 })
      return
    }
    const event = parsed.data
    const info = {
      eventId: event.id,
      type: event.type,
      resource: describe(event.resource),
      version: event.version,
    }

    const admission = guard.admit(event, cachedVersion(queryClient, event.resource))
    if (admission === 'duplicate' || admission === 'stale') {
      record(admission === 'duplicate' ? 'duplicate' : 'stale', info)
      return
    }

    // Also for `known`: the applier only patches entries older than the event, so it can heal a
    // list that a detail refetch got ahead of, and it never reverts anything.
    applyEvent(queryClient, event)
    if (admission === 'known') {
      record('stale', info)
      return
    }

    record('applied', info)
    for (const listener of [...(eventListeners.get(event.type) ?? [])]) {
      try {
        ;(listener as (e: RealtimeEvent) => void)(event)
      } catch (error) {
        // One failing listener must not keep the others from running.
        console.error('[realtime] a listener failed', error)
      }
    }
  }

  const detach = (old: SocketLike) => {
    old.off()
    old.io.off()
    old.disconnect()
  }

  const attach = (next: SocketLike) => {
    socket = next
    let connectedOnce = false

    next.on('connect', () => {
      if (next !== socket) return
      // After a reconnection events may have been missed: refetch what is on screen (RT-17).
      if (connectedOnce) void queryClient?.invalidateQueries()
      connectedOnce = true
      setStatus('connected')
    })
    next.on('disconnect', (reason: string) => {
      if (next !== socket) return
      setStatus(reason === 'io client disconnect' ? 'disconnected' : 'reconnecting')
    })
    next.on('connect_error', () => {
      if (next !== socket) return
      setStatus('reconnecting')
    })
    next.io.on('reconnect_attempt', () => {
      if (next !== socket) return
      setStatus('reconnecting')
    })
    for (const type of REALTIME_EVENT_TYPES) {
      next.on(type, (payload: unknown) => {
        receive(next, type, payload)
      })
    }
    next.connect()
  }

  /** Tears the current socket down and, when allowed, opens one for the current session. */
  const reopen = () => {
    const id = ++generation
    if (socket) {
      const old = socket
      socket = null
      detach(old)
    }
    guard.reset()
    if (!queryClient || !session) {
      setStatus('disconnected')
      return
    }
    setStatus('connecting')
    makeSocket({ token: session.token }).then(
      (created) => {
        if (id !== generation) {
          // The session changed (or the app stopped) while the chunk was loading.
          detach(created)
          return
        }
        attach(created)
      },
      (error: unknown) => {
        if (id !== generation) return
        console.warn('[realtime] could not create the socket', error)
        setStatus('disconnected')
      },
    )
  }

  return {
    start(deps) {
      queryClient = deps.queryClient
      reopen()
    },
    stop() {
      queryClient = null
      reopen()
    },
    setSession(next) {
      if (session?.key === next.key && session.token === next.token) return
      session = next
      reopen()
    },
    status: () => status,
    subscribeStatus(listener) {
      statusListeners.add(listener)
      return () => {
        statusListeners.delete(listener)
      }
    },
    on(type, listener) {
      let set = eventListeners.get(type)
      if (!set) eventListeners.set(type, (set = new Set()))
      set.add(listener)
      return () => {
        set.delete(listener)
      }
    },
    eventLog: () => log,
    subscribeEventLog(listener) {
      logListeners.add(listener)
      return () => {
        logListeners.delete(listener)
      }
    },
  }
}
