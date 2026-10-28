import type { Bus, DomainChange } from './bus'
import { SCHEMA_VERSION, type MockState } from './state'

export const DB_KEY = 'kurio.mock.db'
export const CONFIG_KEY = 'kurio.mock.config'
export const PANEL_KEY = 'kurio.mock.panel'

export interface StorageAdapter {
  get(key: string): string | null
  set(key: string, value: string): void
  remove(key: string): void
}

/** Node and tests: a `Map`. */
export function createMemoryStorage(): StorageAdapter {
  const map = new Map<string, string>()
  return {
    get: (key) => map.get(key) ?? null,
    set: (key, value) => void map.set(key, value),
    remove: (key) => void map.delete(key),
  }
}

/** Browser: `localStorage`, tolerating private windows and blocked storage. */
export function createBrowserStorage(): StorageAdapter {
  return {
    get: (key) => {
      try {
        return localStorage.getItem(key)
      } catch {
        return null
      }
    },
    set: (key, value) => {
      localStorage.setItem(key, value)
    },
    remove: (key) => {
      try {
        localStorage.removeItem(key)
      } catch {
        // nothing to remove
      }
    },
  }
}

/** What a write callback receives: the draft state, the clock and the buffered publisher. */
export interface Tx {
  state: MockState
  /** `Date.now()`, which Playwright's clock and Vitest fake timers both control. */
  now: number
  emit(change: DomainChange): void
}

export interface Store {
  read<T>(fn: (state: Readonly<MockState>) => T): T
  /**
   * Atomic: runs on a clone, so a throw discards everything (no partial cart or order on a 4xx).
   * On success the state is swapped, persisted synchronously, and only then are changes published.
   */
  write<T>(fn: (tx: Tx) => T): T
  /** Replaces the whole state (seed, scenario switch) and persists it. */
  replace(state: MockState): void
  /** Re-reads the state from storage; false when it had to reseed. */
  load(): boolean
  /** Deep copy, for tests and `__mock.snapshot()`. */
  snapshot(): MockState
}

interface StoreOptions {
  storage: StorageAdapter
  bus: Bus
  /** Builds the seed of the active scenario. */
  seed: () => MockState
}

function isState(value: unknown): value is MockState {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { schemaVersion?: unknown }).schemaVersion === SCHEMA_VERSION
  )
}

export function createStore({ storage, bus, seed }: StoreOptions): Store {
  let state: MockState = seed()

  const persist = () => {
    try {
      storage.set(DB_KEY, JSON.stringify(state))
    } catch (error) {
      // Quota exceeded or blocked storage: keep working from memory.
      console.warn('[mock] could not persist the database', error)
    }
  }

  const store: Store = {
    read: (fn) => fn(state),
    write(fn) {
      const draft = structuredClone(state)
      const changes: DomainChange[] = []
      const result = fn({ state: draft, now: Date.now(), emit: (change) => changes.push(change) })
      state = draft
      persist()
      for (const change of changes) bus.publish(change)
      return result
    },
    replace(next) {
      state = next
      persist()
    },
    load() {
      const raw = storage.get(DB_KEY)
      let reason: string | null = null
      if (raw === null) reason = 'no stored database'
      else {
        try {
          const parsed: unknown = JSON.parse(raw)
          if (isState(parsed)) {
            state = parsed
            return true
          }
          reason = 'unknown schema version'
        } catch {
          reason = 'corrupt database'
        }
      }
      console.info(`[mock] reseeding: ${reason}`)
      state = seed()
      persist()
      return false
    },
    snapshot: () => structuredClone(state),
  }
  return store
}
