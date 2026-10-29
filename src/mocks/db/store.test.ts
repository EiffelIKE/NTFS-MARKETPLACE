import { describe, expect, it, vi } from 'vitest'

import { createBus, type DomainChange } from './bus'
import { seed } from './seed'
import { DB_KEY, createMemoryStorage, createStore } from './store'
import { SCHEMA_VERSION } from './state'

function setup() {
  const storage = createMemoryStorage()
  const bus = createBus()
  const events: DomainChange[] = []
  bus.subscribe((change) => events.push(change))
  const store = createStore({ storage, bus, seed: () => seed() })
  return { storage, bus, events, store }
}

describe('store.write', () => {
  it('commits the draft, persists it and publishes only afterwards', () => {
    const { storage } = setup()
    let persistedAtPublish: string | null = null
    const bus = createBus()
    bus.subscribe(() => {
      persistedAtPublish = storage.get(DB_KEY)
    })
    const own = createStore({ storage, bus, seed: () => seed() })
    own.write((tx) => {
      tx.state.seq.user = 99
      tx.emit({ type: 'nft.updated', nftId: 'emerald-ape-042', version: 2 })
    })
    expect(own.read((state) => state.seq.user)).toBe(99)
    expect(persistedAtPublish).toContain('"user":99')
  })

  it('rolls back everything when the callback throws, and publishes nothing', () => {
    const { store, storage, events } = setup()
    const before = store.snapshot()
    storage.remove(DB_KEY)
    expect(() =>
      store.write((tx) => {
        tx.state.seq.order = 500
        tx.emit({ type: 'order.updated', orderId: 'ord_000001', userId: 'usr_000001', version: 2 })
        throw new Error('boom')
      }),
    ).toThrow('boom')
    expect(store.snapshot()).toEqual(before)
    expect(storage.get(DB_KEY)).toBeNull()
    expect(events).toEqual([])
  })

  it('publishes buffered changes in order', () => {
    const { store, events } = setup()
    store.write((tx) => {
      tx.emit({ type: 'nft.updated', nftId: 'emerald-ape-042', version: 2 })
      tx.emit({ type: 'order.updated', orderId: 'ord_000001', userId: 'usr_000001', version: 3 })
    })
    expect(events.map((e) => e.type)).toEqual(['nft.updated', 'order.updated'])
  })

  it('keeps working from memory when storage fails', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const storage = createMemoryStorage()
    storage.set = () => {
      throw new Error('quota')
    }
    const store = createStore({ storage, bus: createBus(), seed: () => seed() })
    store.write((tx) => {
      tx.state.seq.user = 7
    })
    expect(store.read((state) => state.seq.user)).toBe(7)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('hands out a clone: mutating a snapshot does not change the store', () => {
    const { store } = setup()
    const snapshot = store.snapshot()
    snapshot.seq.user = 123
    expect(store.read((state) => state.seq.user)).not.toBe(123)
  })
})

describe('store.load', () => {
  it('restores a persisted state', () => {
    const { store, storage, bus } = setup()
    store.write((tx) => {
      tx.state.seq.user = 42
    })
    const reloaded = createStore({ storage, bus, seed: () => seed() })
    expect(reloaded.load()).toBe(true)
    expect(reloaded.read((state) => state.seq.user)).toBe(42)
  })

  it.each([
    ['nothing stored', () => null],
    ['corrupt JSON', () => '{not json'],
    ['another schema version', () => JSON.stringify({ schemaVersion: SCHEMA_VERSION + 1 })],
    ['a non-object', () => '42'],
    [
      'a valid object with its tables missing',
      () => JSON.stringify({ schemaVersion: SCHEMA_VERSION }),
    ],
    [
      'a catalog table that is gone',
      () => {
        const partial = JSON.parse(JSON.stringify(seed())) as Record<string, unknown>
        delete partial.nfts
        return JSON.stringify(partial)
      },
    ],
  ])('reseeds on %s', (_name, raw) => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const { store, storage } = setup()
    store.write((tx) => {
      tx.state.seq.user = 42
    })
    const value = raw()
    if (value === null) storage.remove(DB_KEY)
    else storage.set(DB_KEY, value)
    expect(store.load()).toBe(false)
    expect(store.read((state) => state.seq.user)).toBe(seed().seq.user)
    expect(storage.get(DB_KEY)).toContain(`"schemaVersion":${String(SCHEMA_VERSION)}`)
    expect(info).toHaveBeenCalledWith(expect.stringContaining('[mock] reseeding'))
    info.mockRestore()
  })
})

describe('bus', () => {
  it('survives a throwing subscriber and supports unsubscribe', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const bus = createBus()
    const received: DomainChange[] = []
    bus.subscribe(() => {
      throw new Error('bad listener')
    })
    const off = bus.subscribe((change) => received.push(change))
    const change: DomainChange = { type: 'nft.updated', nftId: 'emerald-ape-042', version: 2 }
    bus.publish(change)
    off()
    bus.publish(change)
    expect(received).toEqual([change])
    expect(error).toHaveBeenCalledTimes(2)
    error.mockRestore()
  })
})
