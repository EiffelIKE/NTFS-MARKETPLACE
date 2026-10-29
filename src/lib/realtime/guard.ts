import { resourceKey, type RealtimeEvent } from '@/contracts'

// Dedupe and version guard (spec 03 §6, RT-11, RT-12). Per-session state: the manager resets it
// whenever the identity changes.

export type Admission =
  /** New and newer than everything known: apply it and tell the listeners. */
  | 'accepted'
  /** Same id as an event already processed: nothing to do. */
  | 'duplicate'
  /** Not newer than the last event applied for this resource: ignore it. */
  | 'stale'
  /** Not newer than the cached data (a refetch already brought it): patch what is older, but
   *  nothing happened for the listeners. */
  | 'known'

export const SEEN_LIMIT = 1000

export interface EventGuard {
  /**
   * Classifies the event and, unless it is a duplicate or stale, remembers its id and version.
   * `cachedVersion` is the highest version of that resource in the Query cache, or `null`.
   */
  admit(event: RealtimeEvent, cachedVersion: number | null): Admission
  reset(): void
}

export function createGuard(limit = SEEN_LIMIT): EventGuard {
  // Insertion order is eviction order: the oldest id leaves first.
  const seen = new Set<string>()
  const versions = new Map<string, number>()

  return {
    admit(event, cachedVersion) {
      if (seen.has(event.id)) return 'duplicate'
      const key = resourceKey(event.resource)
      const applied = versions.get(key)
      if (applied !== undefined && event.version <= applied) return 'stale'

      seen.add(event.id)
      if (seen.size > limit) {
        const oldest = seen.values().next().value
        if (oldest !== undefined) seen.delete(oldest)
      }
      versions.set(key, event.version)
      return cachedVersion !== null && event.version <= cachedVersion ? 'known' : 'accepted'
    },
    reset() {
      seen.clear()
      versions.clear()
    },
  }
}
