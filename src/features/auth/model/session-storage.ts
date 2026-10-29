import { SessionPayload } from '@/contracts'

/** The only key the session lives under (AUTH-06: the payload and nothing else). */
export const SESSION_KEY = 'kurio.session'

export interface SessionStorage {
  /** The stored session, or `null` when none or when the stored value is not a valid payload. */
  read(): SessionPayload | null
  write(payload: SessionPayload): void
  clear(): void
  /** Stable text for a payload: what `write` stores and what `watch` compares against. */
  serialize(payload: SessionPayload): string
  /** Parses a raw stored value (a `storage` event's `newValue`); `null` when invalid. */
  parse(raw: string | null): SessionPayload | null
  /** Calls `handler` with the raw new value when another tab changes the session. */
  watch(handler: (newValue: string | null) => void): () => void
}

/** `{ token, expiresAt, user }` in a fixed key order, so equal payloads serialize equally. */
function serialize(payload: SessionPayload): string {
  const { token, expiresAt, user } = payload
  return JSON.stringify({ token, expiresAt, user })
}

function parse(raw: string | null): SessionPayload | null {
  if (raw === null) return null
  try {
    const parsed = SessionPayload.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

/**
 * Session persistence in `localStorage` (decision 4). Every access is guarded: with storage
 * blocked (private mode, quota) the session lives in memory for the tab and is lost on reload.
 */
export function createSessionStorage(
  getStorage: () => Storage | undefined = () =>
    typeof localStorage === 'undefined' ? undefined : localStorage,
): SessionStorage {
  let memory: SessionPayload | null = null

  const storage = (): Storage | undefined => {
    try {
      return getStorage()
    } catch {
      return undefined
    }
  }

  return {
    read() {
      const area = storage()
      if (!area) return memory
      let raw: string | null
      try {
        raw = area.getItem(SESSION_KEY)
      } catch {
        return memory
      }
      const payload = parse(raw)
      // An invalid value is removed, so it cannot keep failing on every load.
      if (raw !== null && !payload) this.clear()
      return payload
    },
    write(payload) {
      memory = payload
      try {
        storage()?.setItem(SESSION_KEY, serialize(payload))
      } catch {
        // Memory still holds it.
      }
    },
    clear() {
      memory = null
      try {
        storage()?.removeItem(SESSION_KEY)
      } catch {
        // Nothing to clean up.
      }
    },
    serialize,
    parse,
    watch(handler) {
      if (typeof window === 'undefined') return () => undefined
      const listener = (event: StorageEvent) => {
        // `key === null` is `localStorage.clear()`.
        if (event.key === SESSION_KEY || event.key === null) handler(event.newValue)
      }
      window.addEventListener('storage', listener)
      return () => {
        window.removeEventListener('storage', listener)
      }
    },
  }
}
