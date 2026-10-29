import { QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { must } from '@/lib/test-utils'

import { nftEvent } from './event-kit'
import { createRealtimeManager, type RealtimeManager } from './manager'
import type { SocketLike, SocketOptions } from './socket'

type Handler = (...args: never[]) => void

class Emitter {
  handlers = new Map<string, Set<Handler>>()
  on(event: string, handler: Handler) {
    const set = this.handlers.get(event) ?? new Set()
    set.add(handler)
    this.handlers.set(event, set)
    return this
  }
  off(event?: string, handler?: Handler) {
    if (event === undefined) this.handlers.clear()
    else if (handler) this.handlers.get(event)?.delete(handler)
    else this.handlers.delete(event)
    return this
  }
  fire(event: string, ...args: unknown[]) {
    for (const handler of [...(this.handlers.get(event) ?? [])]) {
      ;(handler as (...a: unknown[]) => void)(...args)
    }
  }
}

/** A socket that cannot connect to anything; tests fire its events by hand. */
class FakeSocket extends Emitter implements SocketLike {
  io = new Emitter()
  connectCalls = 0
  disconnectCalls = 0
  /** Emulates a packet that was already queued when the socket was replaced. */
  stubborn = false
  readonly options: SocketOptions
  constructor(options: SocketOptions) {
    super()
    this.options = options
  }
  override off(event?: string, handler?: Handler) {
    if (!this.stubborn) super.off(event, handler)
    return this
  }
  connect() {
    this.connectCalls += 1
  }
  disconnect() {
    this.disconnectCalls += 1
  }
}

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

function setup() {
  const sockets: FakeSocket[] = []
  const queryClient = new QueryClient()
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
  const manager = createRealtimeManager({
    createSocket: (options) => {
      const socket = new FakeSocket(options)
      sockets.push(socket)
      return Promise.resolve(socket)
    },
  })
  return { manager, sockets, queryClient, invalidate }
}

let current: RealtimeManager | undefined
afterEach(() => {
  current?.stop()
  current = undefined
})

async function started(token: string | null = null, key = 'guest') {
  const ctx = setup()
  current = ctx.manager
  ctx.manager.setSession({ key, token })
  ctx.manager.start({ queryClient: ctx.queryClient })
  await flush()
  const socket = ctx.sockets[0]
  if (!socket) throw new Error('no socket was created')
  return { ...ctx, socket }
}

describe('connect rule', () => {
  it('does not create a socket until it is started and has a session', async () => {
    const { manager, sockets, queryClient } = setup()
    current = manager
    manager.start({ queryClient })
    await flush()
    expect(sockets).toHaveLength(0)
    expect(manager.status()).toBe('disconnected')
    manager.setSession({ key: 'guest', token: null })
    await flush()
    expect(sockets).toHaveLength(1)
    expect(sockets[0]?.connectCalls).toBe(1)
    expect(manager.status()).toBe('connecting')
  })

  it('creates the socket with the session token', async () => {
    const { socket } = await started('tok_ana', 'user:ana')
    expect(socket.options.token).toBe('tok_ana')
  })

  it('closes the socket and its listeners on stop (RT-19)', async () => {
    const { manager, socket } = await started()
    manager.stop()
    expect(socket.disconnectCalls).toBe(1)
    expect(socket.handlers.size).toBe(0)
    expect(socket.io.handlers.size).toBe(0)
    expect(manager.status()).toBe('disconnected')
  })
})

describe('status', () => {
  it('follows the socket (RT-16)', async () => {
    const { manager, socket } = await started()
    const seen: string[] = []
    manager.subscribeStatus(() => seen.push(manager.status()))
    socket.fire('connect')
    socket.fire('disconnect', 'transport close')
    socket.io.fire('reconnect_attempt', 1)
    socket.fire('connect_error', new Error('websocket error'))
    socket.fire('connect')
    socket.fire('disconnect', 'io client disconnect')
    expect(seen).toEqual(['connected', 'reconnecting', 'connected', 'disconnected'])
  })
})

describe('reconciliation (RT-17)', () => {
  it('invalidates the cache on a reconnection, not on the first connect', async () => {
    const { socket, invalidate } = await started()
    socket.fire('connect')
    expect(invalidate).not.toHaveBeenCalled()
    socket.fire('disconnect', 'transport close')
    socket.fire('connect')
    expect(invalidate).toHaveBeenCalledTimes(1)
    expect(invalidate).toHaveBeenCalledWith()
  })
})

describe('session change (RT-18)', () => {
  it('closes the old socket, drops its listeners and opens a new one', async () => {
    const { manager, sockets } = await started('tok_ana', 'user:ana')
    const old = must(sockets[0])
    manager.setSession({ key: 'user:bruno', token: 'tok_bruno' })
    await flush()
    expect(old.disconnectCalls).toBe(1)
    expect(old.handlers.size).toBe(0)
    expect(old.io.handlers.size).toBe(0)
    expect(sockets).toHaveLength(2)
    expect(sockets[1]?.options.token).toBe('tok_bruno')
  })

  it('does nothing when the identity is the same', async () => {
    const { manager, sockets } = await started('tok_ana', 'user:ana')
    manager.setSession({ key: 'user:ana', token: 'tok_ana' })
    await flush()
    expect(sockets).toHaveLength(1)
  })

  it('ignores a packet that was already queued on the old socket', async () => {
    const { manager, sockets, queryClient } = await started('tok_ana', 'user:ana')
    const old = must(sockets[0])
    old.fire('connect')
    old.stubborn = true
    const listener = vi.fn()
    manager.on('nft.updated', listener)
    queryClient.setQueryData(['nfts', 'detail', 'emerald-ape-042'], {
      id: 'emerald-ape-042',
      version: 1,
      price: '1.19',
    })

    manager.setSession({ key: 'user:bruno', token: 'tok_bruno' })
    await flush()
    old.fire('nft.updated', nftEvent(2, '9.99'))
    expect(listener).not.toHaveBeenCalled()
    expect(queryClient.getQueryData(['nfts', 'detail', 'emerald-ape-042'])).toMatchObject({
      price: '1.19',
    })
  })

  it('forgets seen ids and versions, so the new session starts clean', async () => {
    const { manager, sockets } = await started('tok_ana', 'user:ana')
    const listener = vi.fn()
    manager.on('nft.updated', listener)
    sockets[0]?.fire('nft.updated', nftEvent(5, '1.50'))
    manager.setSession({ key: 'user:bruno', token: 'tok_bruno' })
    await flush()
    sockets[1]?.fire('nft.updated', nftEvent(5, '1.50'))
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('discards a socket that finished loading after the session changed', async () => {
    const created: FakeSocket[] = []
    const pending: (() => void)[] = []
    const manager = createRealtimeManager({
      createSocket: (options) =>
        new Promise((resolve) => {
          const socket = new FakeSocket(options)
          created.push(socket)
          pending.push(() => {
            resolve(socket)
          })
        }),
    })
    current = manager
    manager.setSession({ key: 'user:ana', token: 'a' })
    manager.start({ queryClient: new QueryClient() })
    manager.setSession({ key: 'user:bruno', token: 'b' })
    pending.forEach((resolve) => {
      resolve()
    })
    await flush()
    expect(created[0]?.connectCalls).toBe(0)
    expect(created[0]?.disconnectCalls).toBe(1)
    expect(created[1]?.connectCalls).toBe(1)
  })

  it('reports disconnected when the socket cannot be created', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const manager = createRealtimeManager({
      createSocket: () => Promise.reject(new Error('chunk')),
    })
    current = manager
    manager.setSession({ key: 'guest', token: null })
    manager.start({ queryClient: new QueryClient() })
    await flush()
    expect(manager.status()).toBe('disconnected')
    warn.mockRestore()
  })
})

describe('event pipeline', () => {
  // Invalid payloads warn in development; keep the output clean.
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('drops a payload that does not parse, logs it and keeps going (RT-06)', async () => {
    const { manager, socket } = await started()
    const listener = vi.fn()
    manager.on('nft.updated', listener)
    socket.fire('nft.updated', { id: 'x', type: 'nft.updated', data: { price: 1.5 } })
    socket.fire('nft.updated', 'not even an object')
    expect(listener).not.toHaveBeenCalled()
    socket.fire('nft.updated', nftEvent(2, '1.20'))
    expect(listener).toHaveBeenCalledTimes(1)
    expect(manager.eventLog().map((e) => e.outcome)).toEqual(['invalid', 'invalid', 'applied'])
  })

  it('drops an event whose type does not match its socket event name', async () => {
    const { manager, socket } = await started()
    const listener = vi.fn()
    manager.on('nft.updated', listener)
    socket.fire('order.updated', nftEvent(2, '1.20'))
    expect(listener).not.toHaveBeenCalled()
    expect(manager.eventLog()[0]?.outcome).toBe('invalid')
  })

  it('runs listeners once per id and never for old versions (RT-11, RT-12)', async () => {
    const { manager, socket } = await started()
    const listener = vi.fn()
    manager.on('nft.updated', listener)
    socket.fire('nft.updated', nftEvent(3, '1.30'))
    socket.fire('nft.updated', nftEvent(3, '1.30'))
    socket.fire('nft.updated', nftEvent(2, '1.20'))
    expect(listener).toHaveBeenCalledTimes(1)
    expect(manager.eventLog().map((e) => e.outcome)).toEqual(['applied', 'duplicate', 'stale'])
  })

  it('runs listeners after the default applier, so they see the patched cache', async () => {
    const { manager, socket, queryClient } = await started()
    queryClient.setQueryData(['nfts', 'detail', 'emerald-ape-042'], {
      id: 'emerald-ape-042',
      version: 1,
      price: '1.19',
    })
    let seen: unknown
    manager.on('nft.updated', () => {
      seen = queryClient.getQueryData(['nfts', 'detail', 'emerald-ape-042'])
    })
    socket.fire('nft.updated', nftEvent(2, '1.29'))
    expect(seen).toMatchObject({ price: '1.29', version: 2 })
  })

  it('does not tell listeners about an event the cache already had, but still patches older entries', async () => {
    const { manager, socket, queryClient } = await started()
    queryClient.setQueryData(['nfts', 'detail', 'emerald-ape-042'], {
      id: 'emerald-ape-042',
      version: 2,
      price: '1.29',
    })
    queryClient.setQueryData(['nfts', 'list', {}], {
      items: [{ id: 'emerald-ape-042', version: 1, price: '1.19' }],
    })
    const listener = vi.fn()
    manager.on('nft.updated', listener)
    socket.fire('nft.updated', nftEvent(2, '1.29'))
    expect(listener).not.toHaveBeenCalled()
    expect(queryClient.getQueryData(['nfts', 'list', {}])).toMatchObject({
      items: [{ version: 2, price: '1.29' }],
    })
  })

  it('tells a listener that asked for `known` events about one the cache already had (R4)', async () => {
    const { manager, socket, queryClient } = await started()
    queryClient.setQueryData(['nfts', 'detail', 'emerald-ape-042'], {
      id: 'emerald-ape-042',
      version: 2,
      price: '1.29',
    })
    const plain = vi.fn()
    const known = vi.fn()
    manager.on('nft.updated', plain)
    manager.on('nft.updated', known, { known: true })
    socket.fire('nft.updated', nftEvent(2, '1.29'))
    expect(plain).not.toHaveBeenCalled()
    expect(known).toHaveBeenCalledTimes(1)
    // An accepted event reaches both kinds of listener.
    socket.fire('nft.updated', nftEvent(3, '1.39'))
    expect(plain).toHaveBeenCalledTimes(1)
    expect(known).toHaveBeenCalledTimes(2)
  })

  it('keeps running listeners when one throws', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { manager, socket } = await started()
    const second = vi.fn()
    manager.on('nft.updated', () => {
      throw new Error('boom')
    })
    manager.on('nft.updated', second)
    socket.fire('nft.updated', nftEvent(2, '1.20'))
    expect(second).toHaveBeenCalledTimes(1)
    expect(error).toHaveBeenCalled()
    error.mockRestore()
  })

  it('stops calling a listener once it is removed (RT-15)', async () => {
    const { manager, socket } = await started()
    const listener = vi.fn()
    const off = manager.on('nft.updated', listener)
    socket.fire('nft.updated', nftEvent(2, '1.20'))
    off()
    socket.fire('nft.updated', nftEvent(3, '1.30'))
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('only listens to the types it declares', async () => {
    const { socket } = await started()
    expect([...socket.handlers.keys()].sort()).toEqual([
      'connect',
      'connect_error',
      'disconnect',
      'nft.updated',
      'order.updated',
    ])
  })
})
