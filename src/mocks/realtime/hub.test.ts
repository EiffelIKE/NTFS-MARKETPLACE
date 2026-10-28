import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { RealtimeEvent } from '@/contracts'
import { must } from '@/lib/test-utils'

import { createControl } from '../control'
import { createMemoryStorage } from '../db/store'
import { bumpNft } from '../domain/orders'
import { openSession } from '../domain/auth'
import { toNftDetail } from '../domain/mappers'
import { createRuntime } from '../runtime'
import type { ScenarioId } from '../scenarios'
import { HEARTBEAT_MS, parseAuth } from './handler'
import type { Transport } from './types'

const NFT = 'emerald-ape-042'

function setup(scenario: ScenarioId = 'default') {
  const runtime = createRuntime({ storage: createMemoryStorage(), baseUrl: 'http://api.test/api' })
  runtime.useScenario(scenario)
  const control = createControl(runtime)
  runtime.realtime.start()
  const tokenOf = (userId: string) =>
    runtime.store.write((tx) => openSession(tx, must(tx.state.users[userId]), 60_000).token)

  const connect = (token: string | null = null) => {
    const transport = { emit: vi.fn(), close: vi.fn() } satisfies Transport
    const id = runtime.realtime.attach(transport)
    if (token) runtime.realtime.identify(id, { token })
    return { id, transport }
  }
  return { runtime, control, tokenOf, connect }
}

function emitted(transport: { emit: ReturnType<typeof vi.fn> }) {
  return transport.emit.mock.calls.map(([type, payload]) => ({
    type: type as string,
    event: RealtimeEvent.parse(payload),
  }))
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false })
})
afterEach(() => {
  vi.useRealTimers()
})

describe('nft.updated', () => {
  it('reaches every connection, guests included, after the delivery delay', () => {
    const { control, connect } = setup()
    const guest = connect()
    const ana = connect('tok')
    control.updateNft(NFT, { price: '1.29' })

    vi.advanceTimersByTime(49)
    expect(guest.transport.emit).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)

    const [first] = emitted(guest.transport)
    const [second] = emitted(ana.transport)
    expect(first?.type).toBe('nft.updated')
    expect(first?.event).toEqual(second?.event)
    expect(first?.event).toMatchObject({
      id: `evt_nft.updated_${NFT}_2`,
      resource: { type: 'nft', id: NFT },
      version: 2,
      data: { price: '1.29' },
    })
  })

  it('carries the same live fields REST returns after the change (brief §6)', () => {
    const { runtime, control, connect } = setup()
    const { transport } = connect()
    control.updateNft(NFT, { price: '1.29', available: { editionId: 'limited-10', value: 0 } })
    vi.advanceTimersByTime(50)

    const { event } = must(emitted(transport)[0])
    if (event.type !== 'nft.updated') throw new Error('wrong type')
    const detail = toNftDetail(runtime.store.read((state) => must(state.nfts[NFT])))
    expect(event.version).toBe(detail.version)
    expect(event.data.price).toBe(detail.price)
    expect(event.data.available).toBe(detail.available)
    expect(event.data.editions).toEqual(
      detail.editions.map(({ id, available }) => ({ id, available })),
    )
    expect(event.data.editions.find((e) => e.id === 'limited-10')?.available).toBe(0)
  })

  it('sends one event per resource version when a write bumps it twice', () => {
    const { runtime, connect } = setup()
    const { transport } = connect()
    runtime.store.write((tx) => {
      const nft = must(tx.state.nfts[NFT])
      bumpNft(tx, nft)
      bumpNft(tx, nft)
    })
    vi.advanceTimersByTime(50)
    const events = emitted(transport)
    expect(events).toHaveLength(1)
    expect(events[0]?.event.version).toBe(3)
  })

  it('uses the configured delay', () => {
    const { control, connect } = setup()
    const { transport } = connect()
    control.configure({ realtime: { deliveryDelayMs: 500 } })
    control.updateNft(NFT, { price: '1.29' })
    vi.advanceTimersByTime(499)
    expect(transport.emit).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(transport.emit).toHaveBeenCalledTimes(1)
  })

  it('does not publish a change that did nothing', () => {
    const { control, connect } = setup()
    const { transport } = connect()
    control.updateNft(NFT, { price: '1.19' })
    vi.advanceTimersByTime(100)
    expect(transport.emit).not.toHaveBeenCalled()
  })
})

describe('order.updated audience (RT-07, RT-08)', () => {
  it('goes only to the owner, and the log shows who', () => {
    const { control, connect, tokenOf } = setup('pending-order')
    const ana = connect(tokenOf('usr_ana'))
    const bruno = connect(tokenOf('usr_bruno'))
    const guest = connect()
    control.settleOrder('ord_000002', 'confirmed')
    vi.advanceTimersByTime(50)

    const orders = emitted(ana.transport).filter((e) => e.type === 'order.updated')
    expect(orders).toHaveLength(1)
    expect(orders[0]?.event).toMatchObject({
      type: 'order.updated',
      version: 2,
      data: { status: 'confirmed', transaction: { hash: expect.any(String) as string } },
    })
    expect(bruno.transport.emit).not.toHaveBeenCalled()
    expect(guest.transport.emit).not.toHaveBeenCalled()
    const entry = control.realtime.log().find((e) => e.type === 'order.updated')
    expect(entry?.connectionIds).toEqual([ana.id])
  })

  it('logs an event with an empty audience, which is how tests prove isolation', () => {
    const { control, connect, tokenOf } = setup('pending-order')
    connect(tokenOf('usr_bruno'))
    control.settleOrder('ord_000002', 'declined')
    vi.advanceTimersByTime(50)
    const entry = control.realtime.log().find((e) => e.type === 'order.updated')
    expect(entry).toMatchObject({ eventId: 'evt_order.updated_ord_000002_2', connectionIds: [] })
  })

  it('resolves the session at delivery time: an expired token gets nothing private', () => {
    const { control, connect, tokenOf } = setup('pending-order')
    const ana = connect(tokenOf('usr_ana'))
    expect(control.realtime.connections()[0]?.userId).toBe('usr_ana')
    control.settleOrder('ord_000002', 'confirmed')
    control.expireSessions('usr_ana')
    vi.advanceTimersByTime(50)
    expect(ana.transport.emit).not.toHaveBeenCalled()
    expect(control.realtime.connections()[0]?.userId).toBeNull()
  })

  it('treats an unknown token, a non-string token and no auth as a guest', () => {
    const { runtime, control, connect } = setup('pending-order')
    connect('not-a-real-token')
    const id = runtime.realtime.attach({ emit: vi.fn(), close: vi.fn() })
    runtime.realtime.identify(id, { token: 42 })
    runtime.realtime.identify(id, null)
    expect(control.realtime.connections().map((c) => c.userId)).toEqual([null, null])
  })

  it('sends the declined order with its reason', () => {
    const { control, connect, tokenOf } = setup('pending-order')
    const ana = connect(tokenOf('usr_ana'))
    control.settleOrder('ord_000002', 'declined')
    vi.advanceTimersByTime(50)
    // Releasing the reservation also publishes an `nft.updated` for the NFT it held.
    const order = emitted(ana.transport).find((e) => e.type === 'order.updated')
    expect(order?.event).toMatchObject({
      data: { status: 'declined', declineReason: { code: 'PAYMENT_DECLINED' }, transaction: null },
    })
  })
})

describe('connections, drop and restore (RT-09, RT-10)', () => {
  it('drop closes every transport and empties the list', () => {
    const { control, connect } = setup()
    const a = connect()
    const b = connect()
    control.realtime.drop()
    expect(a.transport.close).toHaveBeenCalledTimes(1)
    expect(b.transport.close).toHaveBeenCalledTimes(1)
    expect(control.realtime.connections()).toEqual([])
    expect(() => {
      control.realtime.drop()
    }).not.toThrow()
  })

  it('drop with block refuses connections until restore', () => {
    const { runtime, control } = setup()
    expect(runtime.realtime.accepting()).toBe(true)
    control.realtime.drop({ block: true })
    expect(runtime.realtime.accepting()).toBe(false)
    control.realtime.restore()
    expect(runtime.realtime.accepting()).toBe(true)
  })

  it('a plain drop leaves reconnection allowed', () => {
    const { runtime, control } = setup()
    control.realtime.drop()
    expect(runtime.realtime.accepting()).toBe(true)
  })

  it('the offline scenario makes realtime unavailable, and configure() closes sockets', () => {
    const offline = setup('offline')
    expect(offline.runtime.realtime.accepting()).toBe(false)

    const { runtime, control, connect } = setup()
    const { transport } = connect()
    control.configure({ realtime: { available: false } })
    expect(runtime.realtime.accepting()).toBe(false)
    expect(transport.close).toHaveBeenCalled()
    control.configure({ realtime: { available: true } })
    expect(runtime.realtime.accepting()).toBe(true)
  })

  it('a detached connection receives nothing', () => {
    const { runtime, control, connect } = setup()
    const { id, transport } = connect()
    runtime.realtime.detach(id)
    control.updateNft(NFT, { price: '1.29' })
    vi.advanceTimersByTime(50)
    expect(transport.emit).not.toHaveBeenCalled()
  })

  it('an event queued before a drop is not sent to the dropped connection', () => {
    const { control, connect } = setup()
    const { transport } = connect()
    control.updateNft(NFT, { price: '1.29' })
    control.realtime.drop()
    vi.advanceTimersByTime(50)
    expect(transport.emit).not.toHaveBeenCalled()
    expect(control.realtime.log()[0]?.connectionIds).toEqual([])
  })
})

describe('redeliver and inject (RT-10)', () => {
  it('redeliver re-sends the same envelope with the same id', () => {
    const { control, connect } = setup()
    const { transport } = connect()
    control.updateNft(NFT, { price: '1.29' })
    vi.advanceTimersByTime(50)
    control.realtime.redeliver(1)
    const events = emitted(transport)
    expect(events).toHaveLength(2)
    expect(events[1]?.event).toEqual(events[0]?.event)
    expect(control.realtime.log().map((e) => e.kind)).toEqual(['publish', 'redeliver'])
  })

  it('redeliver goes only to the connections that got the event first, and only if still open', () => {
    const { runtime, control, connect } = setup()
    const first = connect()
    control.updateNft(NFT, { price: '1.29' })
    vi.advanceTimersByTime(50)
    const late = connect()
    runtime.realtime.detach(first.id)
    control.realtime.redeliver()
    expect(first.transport.emit).toHaveBeenCalledTimes(1)
    expect(late.transport.emit).not.toHaveBeenCalled()
  })

  it('redeliver(n) re-sends the last n published events in order', () => {
    const { control, connect } = setup()
    const { transport } = connect()
    control.updateNft(NFT, { price: '1.21' })
    vi.advanceTimersByTime(50)
    control.updateNft(NFT, { price: '1.22' })
    vi.advanceTimersByTime(50)
    control.updateNft(NFT, { price: '1.23' })
    vi.advanceTimersByTime(50)
    control.realtime.redeliver(2)
    expect(emitted(transport).map((e) => e.event.version)).toEqual([2, 3, 4, 3, 4])
  })

  it('inject sends any valid envelope following the normal audience rules', () => {
    const { control, connect, tokenOf } = setup('pending-order')
    const ana = connect(tokenOf('usr_ana'))
    const bruno = connect(tokenOf('usr_bruno'))
    control.realtime.inject({
      id: 'evt_order.updated_ord_000002_9',
      type: 'order.updated',
      resource: { type: 'order', id: 'ord_000002' },
      version: 9,
      occurredAt: '2026-10-28T12:00:00.000Z',
      data: {
        status: 'declined',
        transaction: null,
        declineReason: { code: 'PAYMENT_DECLINED', message: 'x' },
        settledAt: '2026-10-28T12:00:00.000Z',
        updatedAt: '2026-10-28T12:00:00.000Z',
      },
    })
    expect(ana.transport.emit).toHaveBeenCalledTimes(1)
    expect(bruno.transport.emit).not.toHaveBeenCalled()
  })

  it('inject can target chosen connections', () => {
    const { control, connect, tokenOf } = setup('pending-order')
    const ana = connect(tokenOf('usr_ana'))
    const bruno = connect(tokenOf('usr_bruno'))
    control.realtime.inject(
      {
        id: 'evt_nft.updated_emerald-ape-042_7',
        type: 'nft.updated',
        resource: { type: 'nft', id: NFT },
        version: 7,
        occurredAt: '2026-10-28T12:00:00.000Z',
        data: { price: '2.00', available: true, editions: [] },
      },
      { connectionIds: [bruno.id] },
    )
    expect(bruno.transport.emit).toHaveBeenCalledTimes(1)
    expect(ana.transport.emit).not.toHaveBeenCalled()
  })

  it('inject delivers a malformed payload as is and logs it as invalid', () => {
    const { control, connect } = setup()
    const { transport } = connect()
    control.realtime.inject({ type: 'nft.updated', data: { price: 1.5 } })
    expect(transport.emit).toHaveBeenCalledWith('nft.updated', {
      type: 'nft.updated',
      data: { price: 1.5 },
    })
    expect(control.realtime.log()[0]).toMatchObject({ kind: 'inject', eventId: '(invalid)' })
  })

  it('clearLog empties the log', () => {
    const { control, connect } = setup()
    connect()
    control.updateNft(NFT, { price: '1.29' })
    vi.advanceTimersByTime(50)
    expect(control.realtime.log()).toHaveLength(1)
    control.realtime.clearLog()
    expect(control.realtime.log()).toEqual([])
  })
})

describe('start / stop', () => {
  it('publishes nothing until started, and nothing after stop', () => {
    const runtime = createRuntime({
      storage: createMemoryStorage(),
      baseUrl: 'http://api.test/api',
    })
    const control = createControl(runtime)
    const transport = { emit: vi.fn(), close: vi.fn() }
    runtime.realtime.attach(transport)

    control.updateNft(NFT, { price: '1.29' })
    vi.advanceTimersByTime(100)
    expect(transport.emit).not.toHaveBeenCalled()

    runtime.realtime.start()
    control.updateNft(NFT, { price: '1.30' })
    runtime.realtime.stop()
    vi.advanceTimersByTime(100)
    expect(transport.emit).not.toHaveBeenCalled()
  })
})

describe('parseAuth', () => {
  it('reads the token from the CONNECT payload', () => {
    expect(parseAuth('{"token":"abc"}')).toEqual({ token: 'abc' })
    expect(parseAuth('')).toEqual({})
    expect(parseAuth('{}')).toEqual({})
  })

  it('returns null for anything that is not an object', () => {
    expect(parseAuth('{oops')).toBeNull()
    expect(parseAuth('[1]')).toBeNull()
    expect(parseAuth('"x"')).toBeNull()
    expect(parseAuth('null')).toBeNull()
  })

  it('keeps the heartbeat below the 25 s the open packet announces', () => {
    expect(HEARTBEAT_MS).toBeLessThan(25_000)
  })
})
