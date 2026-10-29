import { describe, expect, it } from 'vitest'

import { eth } from '@/lib/money'
import { must } from '@/lib/test-utils'

import { seed } from '../db/seed'
import type { CartRecord, MockState } from '../db/state'
import { buildQuote } from './quote'

const NOW = Date.parse('2026-10-28T12:00:00.000Z')

function cartWith(
  state: MockState,
  lines: [string, number][],
  couponCode: string | null = null,
): CartRecord {
  return {
    id: 'cart_test',
    items: lines.map(([nftId, quantity], index) => {
      const nft = must(state.nfts[nftId])
      return {
        id: `item_${String(index)}`,
        nftId,
        editionId: must(nft.editions.find((e) => e.id === 'open') ?? nft.editions[0]).id,
        quantity,
        addedUnitPrice: nft.price,
      }
    }),
    couponCode,
    version: 1,
    updatedAt: new Date(NOW).toISOString(),
  }
}

function fixture() {
  const state = seed('default')
  const open = Object.values(state.nfts).filter((n) => n.editions.some((e) => e.id === 'open'))
  return { state, a: must(open[0]), b: must(open[1]) }
}

describe('buildQuote', () => {
  it('totals lines, applies the network fee and is purchasable', () => {
    const { state, a, b } = fixture()
    const cart = cartWith(state, [
      [a.id, 2],
      [b.id, 1],
    ])
    const quote = buildQuote(state, cart, 'ethereum', NOW)
    const subtotal = eth.add(eth.times(a.price, 2), b.price)
    expect(quote.subtotal).toBe(subtotal)
    expect(quote.discount).toBe('0')
    expect(quote.total).toBe(eth.add(subtotal, quote.networkFee))
    expect(quote.purchasable).toBe(true)
    expect(quote.issues).toEqual([])
    expect(quote.lines.map((l) => l.lineTotal)).toEqual([eth.times(a.price, 2), b.price])
    expect(quote.issuedAt).toBe(new Date(NOW).toISOString())
  })

  it('is pure: same input gives the same quote id, any content change a different one', () => {
    const { state, a, b } = fixture()
    const cart = cartWith(state, [[a.id, 1]])
    const first = buildQuote(state, cart, 'ethereum', NOW)
    expect(buildQuote(state, cart, 'ethereum', NOW + 60_000).id).toBe(first.id)
    expect(buildQuote(state, cart, 'polygon', NOW).id).not.toBe(first.id)
    expect(buildQuote(state, cartWith(state, [[a.id, 2]]), 'ethereum', NOW).id).not.toBe(first.id)
    expect(
      buildQuote(
        state,
        cartWith(state, [
          [a.id, 1],
          [b.id, 1],
        ]),
        'ethereum',
        NOW,
      ).id,
    ).not.toBe(first.id)
    const repriced = structuredClone(state)
    must(repriced.nfts[a.id]).price = eth.add(a.price, '0.01')
    expect(buildQuote(repriced, cart, 'ethereum', NOW).id).not.toBe(first.id)
  })

  it('applies a percent coupon on the purchasable subtotal', () => {
    const { state, a } = fixture()
    const quote = buildQuote(state, cartWith(state, [[a.id, 1]], 'KURIO10'), 'ethereum', NOW)
    expect(quote.discount).toBe(eth.percent(a.price, 1000))
    expect(quote.total).toBe(eth.add(eth.sub(a.price, quote.discount), quote.networkFee))
    expect(quote.coupon?.code).toBe('KURIO10')
  })

  it('caps a fixed coupon at the subtotal and checks its minimum', () => {
    const { state, a } = fixture()
    const cheap = structuredClone(state)
    must(cheap.nfts[a.id]).price = '0.02'
    const small = buildQuote(cheap, cartWith(cheap, [[a.id, 1]], 'COLECAO05'), 'ethereum', NOW)
    expect(small.issues).toEqual([{ code: 'COUPON_NOT_APPLICABLE', blocking: false }])
    expect(small.discount).toBe('0')
    must(cheap.nfts[a.id]).price = '0.6'
    const enough = buildQuote(cheap, cartWith(cheap, [[a.id, 1]], 'COLECAO05'), 'ethereum', NOW)
    expect(enough.discount).toBe('0.05')
    expect(enough.issues).toEqual([])
  })

  it('flags an expired coupon without blocking the purchase', () => {
    const { state, a } = fixture()
    const quote = buildQuote(state, cartWith(state, [[a.id, 1]], 'VERAO25'), 'ethereum', NOW)
    expect(quote.issues).toEqual([{ code: 'COUPON_EXPIRED', blocking: false }])
    expect(quote.discount).toBe('0')
    expect(quote.purchasable).toBe(true)
  })

  it('reports PRICE_CHANGED as non-blocking and charges the current price', () => {
    const { state, a } = fixture()
    const cart = cartWith(state, [[a.id, 1]])
    const changed = structuredClone(state)
    must(changed.nfts[a.id]).price = eth.add(a.price, '0.1')
    const quote = buildQuote(changed, cart, 'ethereum', NOW)
    expect(quote.issues).toEqual([{ code: 'PRICE_CHANGED', itemId: 'item_0', blocking: false }])
    expect(quote.purchasable).toBe(true)
    expect(must(quote.lines[0]).unitPrice).toBe(eth.add(a.price, '0.1'))
  })

  it('blocks on unavailable and limited lines and leaves unavailable ones out of the totals', () => {
    const { state, a, b } = fixture()
    const cart = cartWith(state, [
      [a.id, 1],
      [b.id, 3],
    ])
    const next = structuredClone(state)
    must(must(next.nfts[a.id]).editions.find((e) => e.id === 'open')).available = 0
    const edition = must(must(next.nfts[b.id]).editions.find((e) => e.id === 'open'))
    edition.available = 2
    const quote = buildQuote(next, cart, 'ethereum', NOW)
    expect(quote.issues.map((i) => [i.code, i.itemId, i.blocking])).toEqual([
      ['UNAVAILABLE', 'item_0', true],
      ['INSUFFICIENT_AVAILABILITY', 'item_1', true],
    ])
    expect(quote.purchasable).toBe(false)
    expect(quote.lines.map((l) => l.itemId)).toEqual(['item_1'])
  })

  it('blocks an empty or missing cart with CART_EMPTY and no fee', () => {
    const { state } = fixture()
    for (const cart of [undefined, cartWith(state, [])]) {
      const quote = buildQuote(state, cart, 'solana', NOW)
      expect(quote.issues).toEqual([{ code: 'CART_EMPTY', blocking: true }])
      expect(quote).toMatchObject({
        purchasable: false,
        networkFee: '0',
        total: '0',
        subtotal: '0',
      })
    }
  })
})
