import { beforeEach, describe, expect, it } from 'vitest'

import { cartApi } from '@/api'
import { actAs, serveMockApi } from '@/api/contract-kit'
import type { Cart, Quote } from '@/contracts'
import { must } from '@/lib/test-utils'

import {
  detailShortages,
  diffQuotes,
  quoteNotes,
  quoteShortages,
  reviewPhase,
  shortageText,
} from './quote-review'

const mock = serveMockApi()

let quote: Quote
let cart: Cart

beforeEach(async () => {
  await actAs('ana')
  quote = await cartApi.quote('ethereum')
  cart = await cartApi.get()
})

const raised = (): Quote => {
  const [first, ...rest] = quote.lines
  const line = must(first)
  return {
    ...quote,
    id: 'quo_changed',
    subtotal: '3.27',
    total: '3.286',
    lines: [{ ...line, unitPrice: '1.29', lineTotal: '1.29' }, ...rest],
  }
}

describe('reviewPhase (CHK-20, CHK-21)', () => {
  it('waits for the first quote', () => {
    expect(reviewPhase({ accepted: null, current: quote })).toBe('loading')
    expect(reviewPhase({ accepted: quote, current: undefined })).toBe('loading')
  })

  it('is ready only while the accepted quote is the current one', () => {
    expect(reviewPhase({ accepted: quote, current: quote })).toBe('ready')
    expect(reviewPhase({ accepted: quote, current: raised() })).toBe('changed')
  })

  it('blocks on a quote that is not purchasable, whatever was accepted', () => {
    const blocked = { ...raised(), purchasable: false }
    expect(reviewPhase({ accepted: quote, current: blocked })).toBe('blocked')
    expect(reviewPhase({ accepted: quote, current: { ...quote, purchasable: false } })).toBe(
      'blocked',
    )
  })
})

describe('diffQuotes', () => {
  it('reports nothing for the same quote', () => {
    const diff = diffQuotes(quote, quote)
    expect(diff.changed).toBe(false)
    expect(diff.lines.size).toBe(0)
    expect(diff.coupon).toBeNull()
  })

  it('reports a price change on the line and the totals', () => {
    const next = raised()
    const diff = diffQuotes(quote, next)
    const line = must(next.lines[0])
    expect(diff.changed).toBe(true)
    expect(diff.lines.get(line.itemId)?.unitPrice).toEqual({
      from: must(quote.lines[0]).unitPrice,
      to: '1.29',
    })
    expect(diff.totals.subtotal).toEqual({ from: quote.subtotal, to: '3.27' })
    expect(diff.totals.total).toEqual({ from: quote.total, to: '3.286' })
    expect(diff.totals.networkFee).toBeUndefined()
  })

  it('reports added and removed lines and a coupon change', () => {
    const [first, ...rest] = quote.lines
    const onlyFirst: Quote = { ...quote, id: 'quo_b', lines: [must(first)] }
    expect(diffQuotes(quote, onlyFirst).removed.map((l) => l.itemId)).toEqual(
      rest.map((l) => l.itemId),
    )
    expect(diffQuotes(onlyFirst, quote).lines.get(must(rest[0]).itemId)).toEqual({ added: true })

    const withCoupon: Quote = {
      ...quote,
      id: 'quo_c',
      coupon: { code: 'KURIO10', kind: 'percent', value: '10' } as unknown as Quote['coupon'],
    }
    expect(diffQuotes(quote, withCoupon).coupon).toEqual({ from: null, to: 'KURIO10' })
  })
})

describe('shortages (CHK-21)', () => {
  it('names the lines of INSUFFICIENT_AVAILABILITY from the cart', () => {
    const line = must(cart.items[0])
    const [one] = detailShortages(
      [{ nftId: line.nftId, editionId: line.editionId, available: 0 }],
      cart.items,
    )
    expect(one).toMatchObject({ name: line.name, available: 0 })
    expect(shortageText(must(one))).toBe(`${line.name}, edição ${line.editionLabel}: esgotado`)
    expect(shortageText({ ...must(one), available: 2 })).toMatch(/restam 2$/)
    expect(shortageText({ ...must(one), available: null })).toMatch(/indisponível$/)
  })

  it('falls back to the ids for a line the cart no longer has', () => {
    const [one] = detailShortages([{ nftId: 'ghost', editionId: 'open', available: 1 }], [])
    expect(one).toMatchObject({ name: 'ghost', editionLabel: 'open' })
  })

  it('lists blocking quote issues, sold out as zero', async () => {
    mock.control.updateNft('emerald-ape-042', { available: { editionId: 'open', value: 0 } })
    const blocked = await cartApi.quote('ethereum')
    const fresh = await cartApi.get()
    expect(blocked.purchasable).toBe(false)
    const shortages = quoteShortages(blocked, fresh.items)
    expect(shortages).toMatchObject([{ nftId: 'emerald-ape-042', available: 0 }])
  })
})

describe('quoteNotes (CHK-22)', () => {
  it('turns non-blocking issues into notes and skips blocking ones', () => {
    const item = must(cart.items[0])
    const noisy: Quote = {
      ...quote,
      issues: [
        { code: 'PRICE_CHANGED', itemId: item.id, blocking: false },
        { code: 'COUPON_EXPIRED', blocking: false },
        { code: 'COUPON_NOT_APPLICABLE', blocking: false },
        { code: 'UNAVAILABLE', itemId: item.id, blocking: true },
      ] as Quote['issues'],
    }
    const notes = quoteNotes(noisy, cart.items)
    expect(notes).toHaveLength(3)
    expect(notes[0]).toContain(item.name)
  })
})
