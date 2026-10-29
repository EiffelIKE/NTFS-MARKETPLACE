import { afterEach, describe, expect, it, vi } from 'vitest'

import { BASE_CONFIG, type FailureRule, type MockConfig } from './config'
import { createNetwork } from './network'

function setup(patch: Partial<MockConfig> = {}) {
  const config: MockConfig = { ...BASE_CONFIG, ...patch }
  return { config, network: createNetwork(() => config) }
}

const rule = (patch: Partial<FailureRule> & Pick<FailureRule, 'id'>): FailureRule => ({
  op: '*',
  effect: { kind: 'network-error' },
  times: 'always',
  ...patch,
})

afterEach(() => {
  vi.useRealTimers()
})

describe('failure rules', () => {
  it('matches by operation or wildcard and consumes finite counts', () => {
    const { network } = setup({
      rules: [
        rule({
          id: 'a',
          op: 'nfts.get',
          times: 2,
          effect: { kind: 'http', status: 503, code: 'SERVICE_UNAVAILABLE' },
        }),
        rule({ id: 'b', op: '*', times: 1 }),
      ],
    })
    expect(network.match('nfts.list')?.id).toBe('b')
    expect(network.match('nfts.list')).toBeNull()
    expect(network.match('nfts.get')?.id).toBe('a')
    expect(network.match('nfts.get')?.id).toBe('a')
    expect(network.match('nfts.get')).toBeNull()
  })

  it('never exhausts an always rule, and reset restores counts', () => {
    const { network } = setup({
      rules: [rule({ id: 'a', times: 1 }), rule({ id: 'z', op: 'cart.get' })],
    })
    expect(network.match('cart.get')?.id).toBe('a')
    expect(network.match('cart.get')?.id).toBe('z')
    expect(network.match('cart.get')?.id).toBe('z')
    network.reset()
    expect(network.match('cart.get')?.id).toBe('a')
  })
})

describe('latency', () => {
  it('follows the configured kind', () => {
    expect(setup({ latency: { kind: 'none' } }).network.latencyFor('nfts.list')).toBe(0)
    expect(setup({ latency: { kind: 'fixed', ms: 250 } }).network.latencyFor('nfts.list')).toBe(250)
  })

  it('draws range latency from a seeded PRNG, repeatably', () => {
    const draw = () => {
      const { network } = setup({ latency: { kind: 'range', minMs: 100, maxMs: 900 }, prngSeed: 7 })
      return Array.from({ length: 12 }, () => network.latencyFor('nfts.list'))
    }
    const first = draw()
    expect(draw()).toEqual(first)
    expect(first.every((ms) => ms >= 100 && ms <= 900)).toBe(true)
    expect(new Set(first).size).toBeGreaterThan(1)
  })

  it('alternates slow and fast for out-of-order operations, per operation', () => {
    const { network } = setup({ outOfOrder: { ops: ['nfts.list'], slowMs: 900, fastMs: 50 } })
    expect([1, 2, 3, 4].map(() => network.latencyFor('nfts.list'))).toEqual([900, 50, 900, 50])
    expect(network.latencyFor('nfts.get')).toBe(120)
  })
})

describe('wait and hang', () => {
  it('resolves immediately for no delay and after the delay otherwise', async () => {
    vi.useFakeTimers()
    const { network } = setup()
    const signal = new AbortController().signal
    await network.wait(0, signal)
    let done = false
    const pending = network.wait(300, signal).then(() => {
      done = true
    })
    await vi.advanceTimersByTimeAsync(299)
    expect(done).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await pending
    expect(done).toBe(true)
  })

  it('rejects with an AbortError as soon as the signal aborts, and clears its timer', async () => {
    vi.useFakeTimers()
    const { network } = setup()
    const controller = new AbortController()
    const pending = network.wait(10_000, controller.signal)
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(vi.getTimerCount()).toBe(0)
    await expect(network.wait(10, controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('hangs until aborted', async () => {
    const { network } = setup()
    const controller = new AbortController()
    const state = { settled: false }
    const pending = network.hang(controller.signal).catch((error: unknown) => {
      state.settled = true
      return error
    })
    await Promise.resolve()
    expect(state.settled).toBe(false)
    controller.abort()
    expect(await pending).toMatchObject({ name: 'AbortError' })
    await expect(network.hang(controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
  })
})

describe('request log', () => {
  it('records, updates, filters and clears entries', () => {
    const { network } = setup()
    const a = network.log.start('nfts.list', 'GET', '/api/nfts')
    const b = network.log.start('cart.get', 'GET', '/api/cart')
    network.log.finish(a, 200)
    network.log.finish(b, 'aborted')
    expect(network.log.list().map((e) => [e.op, e.status])).toEqual([
      ['nfts.list', 200],
      ['cart.get', 'aborted'],
    ])
    expect(network.log.list({ op: 'cart.get' })).toHaveLength(1)
    network.log.clear()
    expect(network.log.list()).toEqual([])
  })

  it('returns copies and keeps only the latest 500 entries', () => {
    const { network } = setup()
    for (let i = 0; i < 510; i++) network.log.start('nfts.list', 'GET', `/api/nfts?i=${String(i)}`)
    const entries = network.log.list()
    expect(entries).toHaveLength(500)
    expect(entries[0]?.url).toBe('/api/nfts?i=10')
    const first = entries[0]
    if (first) first.status = 500
    expect(network.log.list()[0]?.status).toBe('pending')
  })
})
