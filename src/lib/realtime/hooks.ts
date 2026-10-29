import { useEffect, useRef, useSyncExternalStore } from 'react'

import type { EventOf, RealtimeEventType } from '@/contracts'

import { realtime } from './instance'
import type { EventLogEntry, RealtimeStatus } from './manager'

/**
 * Runs `listener` for every `type` event that passed the guards, after the default cache applier,
 * so it sees the patched cache. The listener is removed on unmount (RT-15). Re-renders do not
 * re-register: the latest listener is kept in a ref. `known` also delivers events the cache
 * already had (see `RealtimeManager.on`).
 */
export function useRealtimeEvent<T extends RealtimeEventType>(
  type: T,
  listener: (event: EventOf<T>) => void,
  { enabled = true, known = false }: { enabled?: boolean; known?: boolean } = {},
): void {
  const latest = useRef(listener)
  useEffect(() => {
    latest.current = listener
  })
  useEffect(() => {
    if (!enabled) return
    return realtime.on(
      type,
      (event) => {
        latest.current(event)
      },
      { known },
    )
  }, [type, enabled, known])
}

export function useRealtimeStatus(): RealtimeStatus {
  return useSyncExternalStore(realtime.subscribeStatus, realtime.status)
}

/** What the manager did with the last events (the developer page). */
export function useRealtimeEventLog(): readonly EventLogEntry[] {
  return useSyncExternalStore(realtime.subscribeEventLog, realtime.eventLog)
}
