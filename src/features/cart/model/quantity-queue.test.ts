import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createQuantityQueue, QUANTITY_DEBOUNCE_MS } from './quantity-queue'

/** A server that holds one quantity per line and answers when the test says so. */
function setup(initial = 1) {
  const server = new Map<string, number>([['ci_1', initial]])
  const sent: number[] = []
  const pending: { resolve: () => void; reject: (error: Error) => void }[] = []
  const errors: unknown[] = []
  const queue = createQuantityQueue({
    send: (itemId, quantity) => {
      sent.push(quantity)
      return new Promise<void>((resolve, reject) => {
        pending.push({
          resolve: () => {
            server.set(itemId, quantity)
            resolve()
          },
          reject,
        })
      })
    },
    serverQuantity: (itemId) => server.get(itemId),
    onError: (_itemId, quantity, error) => {
      errors.push([quantity, error])
    },
  })
  return { queue, server, sent, pending, errors }
}

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('quantity queue (CART-08)', () => {
  it('turns five clicks in 200 ms into one request with the last value', async () => {
    const { queue, sent, pending } = setup()
    for (const quantity of [2, 3, 4, 5, 6]) {
      queue.set('ci_1', quantity)
      await vi.advanceTimersByTimeAsync(40)
    }
    expect(sent).toEqual([])
    expect(queue.draft('ci_1')).toBe(6)

    await vi.advanceTimersByTimeAsync(QUANTITY_DEBOUNCE_MS)
    expect(sent).toEqual([6])
    expect(queue.sending('ci_1')).toBe(true)

    pending[0]?.resolve()
    await vi.advanceTimersByTimeAsync(0)
    expect(queue.draft('ci_1')).toBeUndefined()
    expect(queue.sending('ci_1')).toBe(false)
    expect(sent).toEqual([6])
  })

  it('sends one follow-up for a change made during the request, never one per click', async () => {
    const { queue, sent, pending } = setup()
    queue.set('ci_1', 2)
    await vi.advanceTimersByTimeAsync(QUANTITY_DEBOUNCE_MS)
    expect(sent).toEqual([2])

    queue.set('ci_1', 3)
    queue.set('ci_1', 4)
    queue.set('ci_1', 5)
    await vi.advanceTimersByTimeAsync(QUANTITY_DEBOUNCE_MS * 2)
    // Still the first request: nothing else goes out while it is in flight.
    expect(sent).toEqual([2])

    pending[0]?.resolve()
    await vi.advanceTimersByTimeAsync(0)
    expect(sent).toEqual([2, 5])
    expect(queue.draft('ci_1')).toBe(5)

    pending[1]?.resolve()
    await vi.advanceTimersByTimeAsync(0)
    expect(queue.draft('ci_1')).toBeUndefined()
  })

  it('sends nothing when the final draft equals what the server holds', async () => {
    const { queue, sent } = setup(3)
    queue.set('ci_1', 4)
    queue.set('ci_1', 3)
    await vi.advanceTimersByTimeAsync(QUANTITY_DEBOUNCE_MS)
    expect(sent).toEqual([])
    expect(queue.draft('ci_1')).toBeUndefined()
  })

  it('drops the draft on failure so the line shows the server quantity, and reports it once', async () => {
    const { queue, pending, errors } = setup(2)
    queue.set('ci_1', 5)
    await vi.advanceTimersByTimeAsync(QUANTITY_DEBOUNCE_MS)
    pending[0]?.reject(new Error('503'))
    await vi.advanceTimersByTimeAsync(0)
    expect(queue.draft('ci_1')).toBeUndefined()
    expect(queue.sending('ci_1')).toBe(false)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toEqual([5, new Error('503')])
  })

  it('"immediate" skips the quiet period, and lines are independent', async () => {
    const { queue, server, sent } = setup()
    server.set('ci_2', 1)
    queue.set('ci_1', 2, { immediate: true })
    queue.set('ci_2', 4)
    await vi.advanceTimersByTimeAsync(0)
    expect(sent).toEqual([2])
    await vi.advanceTimersByTimeAsync(QUANTITY_DEBOUNCE_MS)
    expect(sent).toEqual([2, 4])
  })

  it('notifies subscribers on every change, and a reset drops what was waiting', async () => {
    const { queue, sent } = setup()
    const listener = vi.fn()
    queue.subscribe(listener)
    const before = queue.snapshot()
    queue.set('ci_1', 2)
    expect(listener).toHaveBeenCalled()
    expect(queue.snapshot()).toBeGreaterThan(before)
    queue.reset()
    expect(queue.draft('ci_1')).toBeUndefined()
    await vi.advanceTimersByTimeAsync(QUANTITY_DEBOUNCE_MS * 2)
    expect(sent).toEqual([])
  })
})
