import { afterEach, describe, expect, it, vi } from 'vitest'

import { cartApi, ordersApi, walletsApi } from '@/api'
import { eth } from '@/lib/money'
import { must } from '@/lib/test-utils'

import { actAs, as, rejection, useFakeClock, serveMockApi } from './contract-kit'
import { connectPrimary, orderBody } from './order-kit'

const mock = serveMockApi()

afterEach(() => {
  vi.useRealTimers()
})

async function anaOrder(key = 'attempt-0001') {
  await actAs('ana')
  await connectPrimary()
  const { body } = await orderBody()
  return { body, key, order: await ordersApi.create(body, { idempotencyKey: key }) }
}

describe('orders.create', () => {
  it('creates a pending order with the quote snapshot and reserves stock', async () => {
    const before = must(mock.control.snapshot().nfts['golden-beat-207']).editions.find(
      (e) => e.id === 'limited-50',
    )
    const { order } = await anaOrder()
    expect(order).toMatchObject({
      id: 'ord_000002',
      status: 'pending',
      subtotal: '3.17',
      discount: '0',
      networkFee: '0.016',
      total: '3.186',
      network: 'ethereum',
      transaction: null,
      declineReason: null,
      settledAt: null,
      version: 1,
    })
    expect(order.lines.map((l) => [l.nftId, l.quantity, l.lineTotal])).toEqual([
      ['emerald-ape-042', 1, '1.19'],
      ['golden-beat-207', 2, '1.98'],
    ])
    expect(order.wallet).toMatchObject({ id: 'wal_000001', provider: 'metamask', role: 'primary' })
    expect(order.collector.email).toBe('ana@kurio.example')
    const after = must(mock.control.snapshot().nfts['golden-beat-207']).editions.find(
      (e) => e.id === 'limited-50',
    )
    expect(after?.available).toBe(must(before?.available) - 2) // reserved
  })

  it('requires a session and an Idempotency-Key', async () => {
    await actAs('ana')
    await connectPrimary()
    const { body } = await orderBody()
    for (const key of ['', 'short', 'has spaces in it!']) {
      const error = await rejection(() => ordersApi.create(body, { idempotencyKey: key }))
      expect(error).toMatchObject({ status: 422, code: 'VALIDATION_FAILED' })
      expect(error.fields).toHaveProperty('Idempotency-Key')
    }
    as()
    expect(
      await rejection(() => ordersApi.create(body, { idempotencyKey: 'attempt-0001' })),
    ).toMatchObject({ status: 401 })
  })

  it('validates the collector details with dotted field paths', async () => {
    await actAs('ana')
    await connectPrimary()
    const { body } = await orderBody()
    const error = await rejection(() =>
      ordersApi.create(
        { ...body, collector: { ...body.collector, email: 'x', referralCode: 'a' } },
        { idempotencyKey: 'attempt-0001' },
      ),
    )
    expect(error.status).toBe(422)
    expect(Object.keys(error.fields ?? {}).sort()).toEqual([
      'collector.email',
      'collector.referralCode',
    ])
    expect(Object.keys(mock.control.snapshot().orders)).toEqual(['ord_000001'])
  })

  it('requires an active connection for the wallet, provider and network', async () => {
    await actAs('ana')
    const { body } = await orderBody()
    const error = await rejection(() => ordersApi.create(body, { idempotencyKey: 'attempt-0001' }))
    expect(error).toMatchObject({ status: 409, code: 'WALLET_NOT_CONNECTED' })
    expect(error.details).toEqual({ walletId: 'wal_000001', network: 'ethereum' })

    await connectPrimary()
    // Connected on Ethereum with MetaMask, not on Polygon.
    const polygon = await orderBody({ network: 'polygon' })
    expect(
      await rejection(() => ordersApi.create(polygon.body, { idempotencyKey: 'attempt-0001' })),
    ).toMatchObject({ code: 'WALLET_NOT_CONNECTED' })

    // A disconnected wallet is not connected either.
    mock.control.disconnectWallet()
    const again = await orderBody()
    expect(
      await rejection(() => ordersApi.create(again.body, { idempotencyKey: 'attempt-0001' })),
    ).toMatchObject({ code: 'WALLET_NOT_CONNECTED' })
  })

  it("rejects another user's wallet (403), an unknown wallet (404) and a wallet that does not support the network (422)", async () => {
    await actAs('ana')
    await connectPrimary()
    const { body } = await orderBody()
    const create = (patch: object) =>
      ordersApi.create({ ...body, ...patch }, { idempotencyKey: 'attempt-0001' })
    expect(await rejection(() => create({ walletId: 'wal_000003' }))).toMatchObject({ status: 403 })
    expect(await rejection(() => create({ walletId: 'wal_999999' }))).toMatchObject({ status: 404 })
    const solana = await rejection(() => create({ network: 'solana' }))
    expect(solana).toMatchObject({ status: 422 })
    expect(solana.fields).toHaveProperty('network')
  })

  it('answers 409 QUOTE_CHANGED with a fresh quote when anything changed', async () => {
    await actAs('ana')
    await connectPrimary()
    const { body, quote } = await orderBody()
    mock.control.updateNft('golden-beat-207', { price: '1.09' })
    const error = await rejection(() => ordersApi.create(body, { idempotencyKey: 'attempt-0001' }))
    expect(error).toMatchObject({ status: 409, code: 'QUOTE_CHANGED' })
    const fresh = (error.details as { quote: { id: string; subtotal: string } }).quote
    expect(fresh.id).not.toBe(quote.id)
    expect(fresh.subtotal).toBe('3.37')
    expect(Object.keys(mock.control.snapshot().orders)).toEqual(['ord_000001']) // nothing created
    // Confirming again with the fresh quote works.
    const retry = await orderBody()
    expect(retry.quote.id).toBe(fresh.id)
    expect((await ordersApi.create(retry.body, { idempotencyKey: 'attempt-0002' })).total).toBe(
      '3.386',
    )
  })

  it('answers 409 INSUFFICIENT_AVAILABILITY when stock ran out', async () => {
    await actAs('ana')
    await connectPrimary()
    const { body } = await orderBody()
    mock.control.updateNft('emerald-ape-042', { available: { editionId: 'open', value: 0 } })
    const error = await rejection(() => ordersApi.create(body, { idempotencyKey: 'attempt-0001' }))
    expect(error).toMatchObject({ status: 409, code: 'INSUFFICIENT_AVAILABILITY' })
    expect(Object.keys(mock.control.snapshot().orders)).toEqual(['ord_000001'])
  })

  it('applies the price-change-on-checkout trigger once, keeping its change', async () => {
    mock.runtime.useScenario('price-change-on-checkout')
    mock.control.configure({ latency: { kind: 'none' } })
    await actAs('ana')
    await connectPrimary()
    const { body } = await orderBody()
    const error = await rejection(() => ordersApi.create(body, { idempotencyKey: 'attempt-0001' }))
    expect(error.code).toBe('QUOTE_CHANGED')
    // Emerald Ape 1.19 → 1.309: the trigger committed even though the order was refused.
    expect(mock.control.snapshot().nfts['emerald-ape-042']?.price).toBe('1.309')
    const retry = await orderBody()
    expect((await ordersApi.create(retry.body, { idempotencyKey: 'attempt-0002' })).status).toBe(
      'pending',
    )
  })

  it('applies the sold-out-on-checkout trigger', async () => {
    mock.runtime.useScenario('sold-out-on-checkout')
    mock.control.configure({ latency: { kind: 'none' } })
    await actAs('ana')
    await connectPrimary()
    const { body } = await orderBody()
    expect(
      await rejection(() => ordersApi.create(body, { idempotencyKey: 'attempt-0001' })),
    ).toMatchObject({ status: 409, code: 'INSUFFICIENT_AVAILABILITY' })
  })
})

describe('idempotency', () => {
  it('returns the same order for the same key and body, and creates only one', async () => {
    const { body, key, order } = await anaOrder()
    const replay = await ordersApi.create(body, { idempotencyKey: key })
    expect(replay).toEqual(order)
    expect(Object.keys(mock.control.snapshot().orders)).toEqual(['ord_000001', order.id])
    expect(mock.control.requests({ op: 'orders.create' })).toHaveLength(2)
  })

  it('answers 409 IDEMPOTENCY_CONFLICT for the same key with a different body', async () => {
    const { body, key, order } = await anaOrder()
    const error = await rejection(() =>
      ordersApi.create({ ...body, note: 'outra coisa' }, { idempotencyKey: key }),
    )
    expect(error).toMatchObject({ status: 409, code: 'IDEMPOTENCY_CONFLICT' })
    expect(error.details).toEqual({ orderId: order.id })
  })

  it('answers 409 ORDER_PENDING with that order for a new key while one is pending', async () => {
    const { body, order } = await anaOrder()
    const error = await rejection(() => ordersApi.create(body, { idempotencyKey: 'attempt-0002' }))
    expect(error).toMatchObject({ status: 409, code: 'ORDER_PENDING' })
    expect(error.details).toEqual({ orderId: order.id })
  })

  it('still replays the same key after the order settled', async () => {
    useFakeClock()
    const { body, key, order } = await anaOrder()
    await vi.advanceTimersByTimeAsync(3000)
    const replay = await ordersApi.create(body, { idempotencyKey: key })
    expect(replay).toMatchObject({ id: order.id, status: 'confirmed' })
  })
})

describe('timeout recovery', () => {
  it('lets the client retry the same key after a timeout and get the same order', async () => {
    useFakeClock()
    mock.runtime.useScenario('order-timeout')
    mock.control.configure({ latency: { kind: 'none' } })
    await actAs('ana')
    await connectPrimary()
    const { body } = await orderBody()

    const first = rejection(() => ordersApi.create(body, { idempotencyKey: 'attempt-0001' }))
    await vi.advanceTimersByTimeAsync(10_000) // the Axios timeout
    expect(await first).toMatchObject({ kind: 'timeout' })

    // The write happened; only the response was lost.
    const created = Object.values(mock.control.snapshot().orders).filter(
      (o) => o.id !== 'ord_000001',
    )
    expect(created).toHaveLength(1)

    const replay = await ordersApi.create(body, { idempotencyKey: 'attempt-0001' })
    expect(replay.id).toBe(must(created[0]).id)
    expect(Object.keys(mock.control.snapshot().orders)).toHaveLength(2) // still one purchase
  })
})

describe('settlement', () => {
  it('confirms after the delay: transaction set, only purchased quantities leave the cart, bus notified', async () => {
    useFakeClock()
    const seen: string[] = []
    const stop = mock.runtime.bus.subscribe((change) =>
      seen.push(`${change.type}:${String(change.version)}`),
    )

    await actAs('ana')
    await connectPrimary()
    // Ana buys 1 of Golden Beat out of the 2 in her cart.
    const [emerald, beat] = (await cartApi.get()).items
    await cartApi.removeItem(must(emerald).id)
    await cartApi.updateItem(must(beat).id, { quantity: 1 })
    const { body } = await orderBody()
    const order = await ordersApi.create(body, { idempotencyKey: 'attempt-0001' })
    // The buyer adds another one while the order is pending.
    await cartApi.addItem({ nftId: 'golden-beat-207', editionId: 'limited-50', quantity: 1 })

    expect((await ordersApi.get(order.id)).status).toBe('pending')
    await vi.advanceTimersByTimeAsync(3000)
    stop()

    const settled = await ordersApi.get(order.id)
    expect(settled.status).toBe('confirmed')
    expect(settled.version).toBe(2)
    expect(settled.transaction?.hash).toMatch(/^0x[0-9a-f]{64}$/)
    expect(settled.transaction?.explorerUrl).toBe(
      `https://explorer.kurio.example/ethereum/tx/${settled.transaction?.hash ?? ''}`,
    )
    expect(settled.transaction?.explorerName).toBe('Etherscan')
    expect(settled.settledAt).not.toBeNull()
    // 2 in the cart − 1 purchased = 1 left.
    expect((await cartApi.get()).items.map((i) => [i.nftId, i.quantity])).toEqual([
      ['golden-beat-207', 1],
    ])
    expect(seen).toContain('order.updated:1')
    expect(seen).toContain('order.updated:2')
  })

  it('declines: reason set, availability restored, cart untouched', async () => {
    useFakeClock()
    mock.runtime.useScenario('payment-declined')
    mock.control.configure({ latency: { kind: 'none' } })
    await actAs('ana')
    await connectPrimary()
    const edition = () =>
      mock.control.snapshot().nfts['golden-beat-207']?.editions.find((e) => e.id === 'limited-50')
    const before = edition()?.available
    const { body } = await orderBody()
    const order = await ordersApi.create(body, { idempotencyKey: 'attempt-0001' })
    expect(edition()?.available).toBe(must(before) - 2)

    await vi.advanceTimersByTimeAsync(3000)
    const settled = await ordersApi.get(order.id)
    expect(settled).toMatchObject({
      status: 'declined',
      declineReason: { code: 'PAYMENT_DECLINED' },
      transaction: null,
    })
    expect(edition()?.available).toBe(before)
    expect((await cartApi.get()).itemCount).toBe(3)
  })

  it('keeps terminal orders terminal and settles by hand in manual scenarios', async () => {
    mock.runtime.useScenario('payment-manual')
    mock.control.configure({ latency: { kind: 'none' } })
    const { order } = await anaOrder()
    expect(Date.parse(order.createdAt)).toBeLessThanOrEqual(Date.now())
    expect((await ordersApi.get(order.id)).status).toBe('pending')
    mock.control.settleOrder(order.id, 'declined')
    expect((await ordersApi.get(order.id)).status).toBe('declined')
    expect(() => {
      mock.control.settleOrder(order.id, 'confirmed')
    }).toThrow(/already declined/)
    expect((await ordersApi.get(order.id)).status).toBe('declined')
  })

  it('settles a due order on the next request even if its timer never fired (as after a reload)', async () => {
    useFakeClock()
    const { order } = await anaOrder()
    // Past the settlement time, with no timer ever firing in this "page".
    mock.runtime.settlement.stop()
    vi.setSystemTime(Date.now() + 5000)
    expect((await ordersApi.get(order.id)).status).toBe('confirmed') // the request tick settles it
  })
})

describe('snapshot', () => {
  it('keeps the receipt amounts when the catalog changes afterwards', async () => {
    useFakeClock()
    const { order } = await anaOrder()
    await vi.advanceTimersByTimeAsync(3000)
    const confirmed = await ordersApi.get(order.id)
    mock.control.updateNft('emerald-ape-042', { price: '9.99' })
    mock.control.updateNft('golden-beat-207', { price: '8.88' })
    expect(await ordersApi.get(order.id)).toEqual(confirmed)
    expect(confirmed.total).toBe('3.186')
    expect(confirmed.lines.map((l) => l.unitPrice)).toEqual(['1.19', '0.99'])
  })

  it('reproduces the seeded confirmed order: a percent coupon, a fee and the stored total', async () => {
    await actAs('ana')
    const order = await ordersApi.get('ord_000001')
    expect(order).toMatchObject({
      status: 'confirmed',
      subtotal: '2.47',
      discount: '0.247',
      networkFee: '0.016',
      total: '2.239',
      coupon: { code: 'KURIO10' },
    })
    expect(order.total).toBe(eth.add(eth.sub(order.subtotal, order.discount), order.networkFee))
  })
})

describe('orders.get and orders.list', () => {
  it("returns 403 for another user's order and 404 for an unknown id", async () => {
    await actAs('bruno')
    expect(await rejection(() => ordersApi.get('ord_000001'))).toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    })
    expect(await rejection(() => ordersApi.get('ord_999999'))).toMatchObject({ status: 404 })
    as()
    expect(await rejection(() => ordersApi.get('ord_000001'))).toMatchObject({ status: 401 })
  })

  it('lists only the session user orders, newest first, with an optional status filter', async () => {
    mock.runtime.useScenario('pending-order')
    mock.control.configure({ latency: { kind: 'none' } })
    await actAs('ana')
    const { items } = await ordersApi.list()
    expect(items.map((o) => [o.id, o.status])).toEqual([
      ['ord_000002', 'pending'],
      ['ord_000001', 'confirmed'],
    ])
    expect(items[1]).toMatchObject({ itemCount: 3, total: '2.239' })
    expect((await ordersApi.list({ status: 'pending' })).items.map((o) => o.id)).toEqual([
      'ord_000002',
    ])
    await actAs('bruno')
    expect((await ordersApi.list()).items).toEqual([])
  })
})

describe('isolation', () => {
  it("never shows one user's private data to another", async () => {
    await actAs('ana')
    const anaWallets = (await walletsApi.list()).items.map((w) => w.id)
    const anaCart = await cartApi.get()
    await actAs('bruno')
    expect((await walletsApi.list()).items.map((w) => w.id)).toEqual(['wal_000003'])
    expect(anaWallets).not.toContain('wal_000003')
    expect((await cartApi.get()).items).toEqual([])
    expect(anaCart.items).not.toEqual([])
    expect((await ordersApi.list()).items).toEqual([])
  })
})
