import { afterEach, describe, expect, it, vi } from 'vitest'

import { clearGuestCartId, getGuestCartId, setGuestCartId } from './guest-cart-id'

function memoryStorage(): Storage {
  const data = new Map<string, string>()
  return {
    get length() {
      return data.size
    },
    clear: () => {
      data.clear()
    },
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => {
      data.delete(key)
    },
    setItem: (key, value) => {
      data.set(key, value)
    },
  }
}

afterEach(() => {
  clearGuestCartId()
  vi.unstubAllGlobals()
})

describe('guest cart id', () => {
  it('sets, reads and clears the id in localStorage', () => {
    const storage = memoryStorage()
    vi.stubGlobal('localStorage', storage)

    expect(getGuestCartId()).toBeNull()
    setGuestCartId('g_0001')
    expect(getGuestCartId()).toBe('g_0001')
    expect(storage.getItem('kurio.guestCartId')).toBe('g_0001')
    clearGuestCartId()
    expect(getGuestCartId()).toBeNull()
    expect(storage.getItem('kurio.guestCartId')).toBeNull()
  })

  it('falls back to memory when localStorage throws (private mode)', () => {
    const blocked = new Proxy({} as Storage, {
      get() {
        throw new Error('SecurityError')
      },
    })
    vi.stubGlobal('localStorage', blocked)

    expect(getGuestCartId()).toBeNull()
    setGuestCartId('g_0002')
    expect(getGuestCartId()).toBe('g_0002')
    clearGuestCartId()
    expect(getGuestCartId()).toBeNull()
  })
})
