/**
 * Browser storage that never throws: a blocked or full area (private mode, quota) only loses the
 * value, which for the checkout means the draft or the attempt does not survive a reload.
 */
export interface SafeStorage {
  get(key: string): string | null
  set(key: string, value: string): void
  remove(key: string): void
}

export function safeStorage(getArea: () => Storage | undefined): SafeStorage {
  const area = (): Storage | undefined => {
    try {
      return getArea()
    } catch {
      return undefined
    }
  }
  return {
    get(key) {
      try {
        return area()?.getItem(key) ?? null
      } catch {
        return null
      }
    },
    set(key, value) {
      try {
        area()?.setItem(key, value)
      } catch {
        // The value is lost on reload; nothing else depends on it.
      }
    },
    remove(key) {
      try {
        area()?.removeItem(key)
      } catch {
        // Nothing to clean up.
      }
    },
  }
}

export const localArea = safeStorage(() =>
  typeof localStorage === 'undefined' ? undefined : localStorage,
)
export const sessionArea = safeStorage(() =>
  typeof sessionStorage === 'undefined' ? undefined : sessionStorage,
)

/** An in-memory area, for tests and for runtimes without storage. */
export function memoryStorage(): SafeStorage {
  const map = new Map<string, string>()
  return {
    get: (key) => map.get(key) ?? null,
    set: (key, value) => {
      map.set(key, value)
    },
    remove: (key) => {
      map.delete(key)
    },
  }
}
