/**
 * Latest-value-wins sender for quantity edits (spec 07 design §5, CART-08). The stepper writes a
 * draft per line; the queue waits for a quiet moment, then sends one request. While a request is in
 * flight, later values only replace the draft; when it settles, the draft is sent if it still
 * differs from what the server holds. So a burst of clicks costs one request, and a click during a
 * request costs one more, never a request per click.
 */
export interface QuantityQueueDeps {
  /** Sends the quantity; resolves once the cache holds the server's answer, rejects on failure. */
  send: (itemId: string, quantity: number) => Promise<void>
  /** The quantity the server (the cache) holds for the line; `undefined` when the line is gone. */
  serverQuantity: (itemId: string) => number | undefined
  /** A request failed: the draft is already dropped, so the line shows the server's quantity. */
  onError: (itemId: string, quantity: number, error: unknown) => void
  debounceMs?: number
}

export interface QuantityQueue {
  /** Records the wanted quantity; `immediate` skips the quiet period (button actions). */
  set: (itemId: string, quantity: number, options?: { immediate?: boolean }) => void
  /** The quantity being edited, or `undefined` when the line shows the server's. */
  draft: (itemId: string) => number | undefined
  /** Whether a request for the line is in flight. */
  sending: (itemId: string) => boolean
  /** Drops the draft and timer of a line (it was removed). */
  discard: (itemId: string) => void
  /** Replaces the callbacks (the screen binds the latest ones after each render). */
  bind: (next: QuantityQueueDeps) => void
  /** Drops every draft and timer (the page is leaving); the queue stays usable. */
  reset: () => void
  subscribe: (listener: () => void) => () => void
  /** Changes whenever a draft or a request starts or ends (for `useSyncExternalStore`). */
  snapshot: () => number
}

export const QUANTITY_DEBOUNCE_MS = 300

export function createQuantityQueue(initial: QuantityQueueDeps): QuantityQueue {
  let deps = initial
  const debounceMs = initial.debounceMs ?? QUANTITY_DEBOUNCE_MS
  const drafts = new Map<string, number>()
  const timers = new Map<string, ReturnType<typeof setTimeout>>()
  const inFlight = new Set<string>()
  const listeners = new Set<() => void>()
  let version = 0

  const changed = () => {
    version += 1
    for (const listener of [...listeners]) listener()
  }

  const clearTimer = (itemId: string) => {
    const timer = timers.get(itemId)
    if (timer !== undefined) clearTimeout(timer)
    timers.delete(itemId)
  }

  const flush = async (itemId: string): Promise<void> => {
    timers.delete(itemId)
    const wanted = drafts.get(itemId)
    if (wanted === undefined || inFlight.has(itemId)) return
    if (wanted === deps.serverQuantity(itemId)) {
      drafts.delete(itemId)
      changed()
      return
    }
    inFlight.add(itemId)
    changed()
    try {
      await deps.send(itemId, wanted)
      inFlight.delete(itemId)
      if (drafts.get(itemId) === wanted) drafts.delete(itemId)
      // The user kept editing during the request: send the newest value next.
      else if (drafts.has(itemId)) schedule(itemId, 0)
    } catch (error) {
      inFlight.delete(itemId)
      // The line shows the server's quantity again; the retry is the caller's to offer.
      drafts.delete(itemId)
      clearTimer(itemId)
      deps.onError(itemId, wanted, error)
    }
    changed()
  }

  function schedule(itemId: string, delay: number) {
    clearTimer(itemId)
    timers.set(
      itemId,
      setTimeout(() => {
        void flush(itemId)
      }, delay),
    )
  }

  return {
    set(itemId, quantity, options) {
      drafts.set(itemId, quantity)
      changed()
      // While a request is in flight the draft only waits: the settle handler picks it up.
      if (!inFlight.has(itemId)) schedule(itemId, options?.immediate ? 0 : debounceMs)
    },
    draft: (itemId) => drafts.get(itemId),
    sending: (itemId) => inFlight.has(itemId),
    discard(itemId) {
      clearTimer(itemId)
      if (drafts.delete(itemId)) changed()
    },
    bind(next) {
      deps = next
    },
    reset() {
      for (const timer of timers.values()) clearTimeout(timer)
      timers.clear()
      if (drafts.size > 0) {
        drafts.clear()
        changed()
      }
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    snapshot: () => version,
  }
}
