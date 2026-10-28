import { describe, expect, it } from 'vitest'

import { cartApi } from '@/api'
import { eth } from '@/lib/money'
import { must } from '@/lib/test-utils'

import { actAs, as, loginAs, rejection, serveMockApi } from './contract-kit'

const mock = serveMockApi()

describe('cart.get', () => {
  it('returns Ana her seeded cart with limits, status and per-line totals', async () => {
    await actAs('ana')
    const cart = await cartApi.get()
    expect(cart).toMatchObject({ id: 'cart_usr_ana', itemCount: 3, version: 1, coupon: null })
    expect(cart.items.map((i) => [i.nftId, i.editionId, i.quantity, i.status])).toEqual([
      ['emerald-ape-042', 'open', 1, 'ok'],
      ['golden-beat-207', 'limited-50', 2, 'ok'],
    ])
    const beat = cart.items[1]
    expect(beat).toMatchObject({
      unitPrice: '0.99',
      lineTotal: '1.98',
      maxQuantity: 5,
      available: 24,
    })
  })

  it('returns an empty cart for a user without one, and null id for an unknown guest', async () => {
    await actAs('bruno')
    expect(await cartApi.get()).toMatchObject({ id: 'cart_usr_bruno', items: [], itemCount: 0 })
    as(undefined, 'g_unknown')
    expect(await cartApi.get()).toMatchObject({ id: null, items: [] })
    as()
    expect(await cartApi.get()).toMatchObject({ id: null, items: [] })
  })
})

describe('cart items', () => {
  it('adds an item, sums quantities of the same line and persists', async () => {
    await actAs('bruno')
    await cartApi.addItem({ nftId: 'sage-nomad-009', editionId: 'limited-10', quantity: 1 })
    const cart = await cartApi.addItem({
      nftId: 'sage-nomad-009',
      editionId: 'limited-10',
      quantity: 1,
    })
    expect(cart.items).toHaveLength(1)
    expect(cart.items[0]).toMatchObject({ quantity: 2, editionLabel: '1/10', maxQuantity: 3 })
    expect((await cartApi.get()).version).toBe(cart.version)
  })

  it('answers 409 with the available quantity when the limit is exceeded', async () => {
    await actAs('bruno')
    // 1/10 of Sage Nomad: max per order 3, 6 available → limit 3.
    const error = await rejection(() =>
      cartApi.addItem({ nftId: 'sage-nomad-009', editionId: 'limited-10', quantity: 4 }),
    )
    expect(error).toMatchObject({ status: 409, code: 'INSUFFICIENT_AVAILABILITY' })
    expect(error.details).toEqual({
      lines: [{ nftId: 'sage-nomad-009', editionId: 'limited-10', requested: 4, available: 3 }],
    })
    // Stock below the per-order maximum: Violet Nomad 1/50 has 1 left.
    const low = await rejection(() =>
      cartApi.addItem({ nftId: 'violet-nomad-314', editionId: 'limited-50', quantity: 2 }),
    )
    expect(low.details).toMatchObject({ lines: [{ available: 1 }] })
    expect((await cartApi.get()).items).toEqual([]) // nothing partial was written
  })

  it('answers 409 EDITION_UNAVAILABLE for a sold-out edition', async () => {
    await actAs('bruno')
    const error = await rejection(() =>
      cartApi.addItem({ nftId: 'cosmic-bloom-118', editionId: 'unique', quantity: 1 }),
    )
    expect(error).toMatchObject({ status: 409, code: 'EDITION_UNAVAILABLE' })
    expect(error.details).toEqual({ nftId: 'cosmic-bloom-118', editionId: 'unique' })
  })

  it('answers 404 for an unknown NFT or edition and 422 for a bad quantity', async () => {
    await actAs('bruno')
    expect(
      await rejection(() =>
        cartApi.addItem({ nftId: 'no-such-nft', editionId: 'open', quantity: 1 }),
      ),
    ).toMatchObject({ status: 404 })
    expect(
      await rejection(() =>
        cartApi.addItem({ nftId: 'penny-pixel-001', editionId: 'unique', quantity: 1 }),
      ),
    ).toMatchObject({ status: 404 })
    for (const quantity of [0, -1, 1.5]) {
      const error = await rejection(() =>
        cartApi.addItem({ nftId: 'penny-pixel-001', editionId: 'open', quantity }),
      )
      expect(error).toMatchObject({ status: 422, code: 'VALIDATION_FAILED' })
      expect(error.fields).toHaveProperty('quantity')
    }
  })

  it('updates the quantity within the limit, and removes an item', async () => {
    await actAs('ana')
    const before = await cartApi.get()
    const beat = must(before.items[1]).id
    const updated = await cartApi.updateItem(beat, { quantity: 5 })
    expect(updated.items[1]?.quantity).toBe(5)
    expect(updated.version).toBeGreaterThan(before.version)
    expect(await rejection(() => cartApi.updateItem(beat, { quantity: 6 }))).toMatchObject({
      status: 409,
      code: 'INSUFFICIENT_AVAILABILITY',
    })
    expect(await rejection(() => cartApi.updateItem(beat, { quantity: 0 }))).toMatchObject({
      status: 422,
    })
    const removed = await cartApi.removeItem(beat)
    expect(removed.items.map((i) => i.nftId)).toEqual(['emerald-ape-042'])
  })

  it('keeps carts apart: another user gets 403, an unknown item 404', async () => {
    await actAs('ana')
    const anaItem = must((await cartApi.get()).items[0]).id
    await actAs('bruno')
    for (const call of [
      () => cartApi.updateItem(anaItem, { quantity: 1 }),
      () => cartApi.removeItem(anaItem),
    ]) {
      expect(await rejection(call)).toMatchObject({ status: 403, code: 'FORBIDDEN' })
    }
    expect(await rejection(() => cartApi.removeItem('ci_999999'))).toMatchObject({ status: 404 })
    await actAs('ana')
    expect((await cartApi.get()).items).toHaveLength(2)
  })

  it('reflects price and availability changes, with status priority', async () => {
    await actAs('ana')
    mock.control.updateNft('golden-beat-207', { price: '1.09' })
    let cart = await cartApi.get()
    expect(cart.items[1]).toMatchObject({
      unitPrice: '1.09',
      addedUnitPrice: '0.99',
      status: 'price_changed',
    })

    mock.control.updateNft('golden-beat-207', { available: { editionId: 'limited-50', value: 1 } })
    cart = await cartApi.get()
    expect(cart.items[1]).toMatchObject({ status: 'limited', maxQuantity: 1 }) // limited beats price_changed

    mock.control.updateNft('golden-beat-207', { available: { editionId: 'limited-50', value: 0 } })
    expect((await cartApi.get()).items[1]?.status).toBe('unavailable')

    mock.control.updateNft('golden-beat-207', { available: { editionId: 'limited-50', value: 20 } })
    const line = must((await cartApi.get()).items[1])
    const acknowledged = await cartApi.updateItem(line.id, { acknowledgePrice: true })
    expect(acknowledged.items[1]).toMatchObject({ addedUnitPrice: '1.09', status: 'ok' })
  })
})

describe('coupons', () => {
  it('applies and removes a valid coupon', async () => {
    await actAs('ana')
    const applied = await cartApi.applyCoupon('kurio10')
    expect(applied.coupon).toMatchObject({ code: 'KURIO10', kind: 'percent', value: '10' })
    expect((await cartApi.removeCoupon()).coupon).toBeNull()
    expect((await cartApi.removeCoupon()).coupon).toBeNull() // always succeeds
  })

  it.each([
    ['NOPE', 'COUPON_INVALID'],
    ['VERAO25', 'COUPON_EXPIRED'],
  ] as const)('rejects %s with %s on the code field', async (code, expected) => {
    await actAs('ana')
    const error = await rejection(() => cartApi.applyCoupon(code))
    expect(error).toMatchObject({ status: 422, code: expected })
    expect(error.fields).toHaveProperty('code')
    expect((await cartApi.get()).coupon).toBeNull()
  })

  it('rejects COLECAO05 below its minimum subtotal and accepts it above', async () => {
    await actAs('bruno')
    await cartApi.addItem({ nftId: 'penny-pixel-001', editionId: 'open', quantity: 1 }) // 0.02
    expect(await rejection(() => cartApi.applyCoupon('COLECAO05'))).toMatchObject({
      status: 422,
      code: 'COUPON_NOT_APPLICABLE',
    })
    await cartApi.addItem({ nftId: 'sage-nomad-009', editionId: 'open', quantity: 1 }) // + 1.69
    expect((await cartApi.applyCoupon('COLECAO05')).coupon?.code).toBe('COLECAO05')
  })

  it('validates the body (422)', async () => {
    await actAs('ana')
    expect(await rejection(() => cartApi.applyCoupon('  '))).toMatchObject({ status: 422 })
  })
})

describe('guest cart and merge', () => {
  it('creates a guest cart on the first add and returns its id', async () => {
    const first = await cartApi.addItem({
      nftId: 'penny-pixel-001',
      editionId: 'open',
      quantity: 2,
    })
    expect(first.id).toMatch(/^g_\d+$/)
    as(undefined, first.id ?? '')
    expect((await cartApi.get()).itemCount).toBe(2)
    const second = await cartApi.addItem({
      nftId: 'sage-nomad-009',
      editionId: 'open',
      quantity: 1,
    })
    expect(second.id).toBe(first.id)
  })

  it('merges a guest cart into the user cart with a capped adjustment, once', async () => {
    const guest = await cartApi.addItem({
      nftId: 'golden-beat-207',
      editionId: 'limited-50',
      quantity: 4,
    })
    const guestId = guest.id ?? ''
    as(undefined, guestId)
    await cartApi.addItem({ nftId: 'penny-pixel-001', editionId: 'open', quantity: 1 })

    await actAs('ana') // Ana already has 2 × 1/50 of Golden Beat (max 5)
    const merged = await cartApi.merge(guestId)
    expect(merged.adjustments).toEqual([
      {
        nftId: 'golden-beat-207',
        editionId: 'limited-50',
        requested: 4,
        applied: 3,
        reason: 'capped',
      },
    ])
    expect(merged.cart.items.map((i) => [i.nftId, i.quantity])).toEqual([
      ['emerald-ape-042', 1],
      ['golden-beat-207', 5],
      ['penny-pixel-001', 1],
    ])

    // The guest cart is gone, and merging again changes nothing.
    const again = await cartApi.merge(guestId)
    expect(again.adjustments).toEqual([])
    expect(again.cart.version).toBe(merged.cart.version)
    as(undefined, guestId)
    expect(await cartApi.get()).toMatchObject({ id: null, items: [] })
  })

  it('reports lines that cannot be added as unavailable', async () => {
    const guest = await cartApi.addItem({
      nftId: 'violet-nomad-314',
      editionId: 'limited-50',
      quantity: 1,
    })
    mock.control.updateNft('violet-nomad-314', { available: { editionId: 'limited-50', value: 0 } })
    await actAs('bruno')
    const merged = await cartApi.merge(guest.id ?? '')
    expect(merged.adjustments[0]).toMatchObject({ applied: 0, reason: 'unavailable' })
    expect(merged.cart.items).toEqual([])
  })

  it('merging a cart that does not exist succeeds with no changes; 401 without a session, 422 bad body', async () => {
    await actAs('bruno')
    expect(await cartApi.merge('g_gone')).toMatchObject({ adjustments: [], cart: { items: [] } })
    expect(await rejection(() => cartApi.merge(''))).toMatchObject({ status: 422 })
    as()
    expect(await rejection(() => cartApi.merge('g_1'))).toMatchObject({ status: 401 })
  })

  it('ignores the guest header when a valid bearer is present', async () => {
    const guest = await cartApi.addItem({
      nftId: 'penny-pixel-001',
      editionId: 'open',
      quantity: 1,
    })
    const token = await loginAs('bruno')
    as(token, guest.id ?? '')
    expect(await cartApi.get()).toMatchObject({ id: 'cart_usr_bruno', items: [] })
  })
})

describe('quote.get', () => {
  it('computes subtotal, fee and total for Ana on Ethereum (Figma fee)', async () => {
    await actAs('ana')
    const quote = await cartApi.quote('ethereum')
    expect(quote).toMatchObject({
      subtotal: '3.17',
      discount: '0',
      networkFee: '0.016',
      total: '3.186',
      purchasable: true,
      network: 'ethereum',
      issues: [],
    })
    expect(quote.lines.map((l) => l.lineTotal)).toEqual(['1.19', '1.98'])
    expect(quote.id).toMatch(/^q_[0-9a-f]{24}$/)
  })

  it('applies a percentage discount exactly and keeps total = subtotal − discount + fee', async () => {
    await actAs('ana')
    await cartApi.applyCoupon('KURIO10')
    for (const network of ['ethereum', 'polygon', 'solana'] as const) {
      const quote = await cartApi.quote(network)
      expect(quote.discount).toBe('0.317')
      expect(quote.total).toBe(eth.add(eth.sub(quote.subtotal, quote.discount), quote.networkFee))
    }
    expect((await cartApi.quote('polygon')).networkFee).toBe('0.002')
  })

  it('changes the id with the network, a price, or the coupon, and is stable otherwise', async () => {
    await actAs('ana')
    const a = await cartApi.quote('ethereum')
    expect((await cartApi.quote('ethereum')).id).toBe(a.id)
    expect((await cartApi.quote('polygon')).id).not.toBe(a.id)
    await cartApi.applyCoupon('KURIO10')
    const withCoupon = await cartApi.quote('ethereum')
    expect(withCoupon.id).not.toBe(a.id)
    mock.control.updateNft('golden-beat-207', { price: '1.09' })
    const repriced = await cartApi.quote('ethereum')
    expect(repriced.id).not.toBe(withCoupon.id)
    expect(repriced.issues).toEqual([
      { code: 'PRICE_CHANGED', itemId: expect.any(String) as string, blocking: false },
    ])
    expect(repriced.purchasable).toBe(true)
  })

  it('blocks on unavailable or limited lines and on an empty cart', async () => {
    await actAs('ana')
    mock.control.updateNft('emerald-ape-042', { available: { editionId: 'open', value: 0 } })
    mock.control.updateNft('golden-beat-207', { available: { editionId: 'limited-50', value: 1 } })
    const quote = await cartApi.quote('ethereum')
    expect(quote.purchasable).toBe(false)
    expect(quote.issues.map((i) => i.code).sort()).toEqual([
      'INSUFFICIENT_AVAILABILITY',
      'UNAVAILABLE',
    ])
    expect(quote.lines).toHaveLength(1) // the unavailable line is excluded

    await actAs('bruno')
    expect(await cartApi.quote('ethereum')).toMatchObject({
      purchasable: false,
      subtotal: '0',
      networkFee: '0',
      total: '0',
      issues: [{ code: 'CART_EMPTY', blocking: true }],
    })
  })

  it('reports an expired or unmet coupon as a non-blocking issue with no discount', async () => {
    await actAs('bruno')
    await cartApi.addItem({ nftId: 'sage-nomad-009', editionId: 'open', quantity: 1 })
    await cartApi.applyCoupon('COLECAO05')
    await cartApi.removeItem(must((await cartApi.get()).items[0]).id)
    await cartApi.addItem({ nftId: 'penny-pixel-001', editionId: 'open', quantity: 1 })
    const quote = await cartApi.quote('ethereum')
    expect(quote.discount).toBe('0')
    expect(quote.issues).toEqual([{ code: 'COUPON_NOT_APPLICABLE', blocking: false }])
    expect(quote.purchasable).toBe(true)
  })

  it('answers 422 for an unknown network', async () => {
    await actAs('ana')
    expect(await rejection(() => cartApi.quote('bitcoin' as never))).toMatchObject({ status: 422 })
  })
})
