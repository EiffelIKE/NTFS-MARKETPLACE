const KEY = 'kurio.guestCartId'

/** Used when `localStorage` is unavailable (private mode, blocked storage): the id lives for the tab. */
let memory: string | null = null

/**
 * The guest's cart id (spec 07 design §4): the only thing a guest keeps between visits. The HTTP
 * interceptor sends it as `X-Guest-Cart-Id` while nobody is signed in, and the post-login merge
 * clears it (spec 07). Every storage access is wrapped, because it throws in some privacy modes.
 */
export function getGuestCartId(): string | null {
  try {
    return localStorage.getItem(KEY) ?? memory
  } catch {
    return memory
  }
}

export function setGuestCartId(id: string): void {
  memory = id
  try {
    localStorage.setItem(KEY, id)
  } catch {
    // The in-memory copy keeps the cart for this tab.
  }
}

export function clearGuestCartId(): void {
  memory = null
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Nothing stored, nothing to clear.
  }
}
