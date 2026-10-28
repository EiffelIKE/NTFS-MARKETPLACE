import type { NetworkId, Quote, QuoteIssue } from '@/contracts'
import { eth } from '@/lib/money'

import type { CartRecord, MockState } from '../db/state'
import { fingerprint } from '../lib/crypto'
import { PAYMENT_NETWORKS } from '../fixtures/networks'
import { itemStatus, purchasableSubtotal } from './cart'
import { toCoupon } from './mappers'

/**
 * Builds the quote of a cart for a payment network (spec 02 §8.3). Pure: same state, same output.
 *
 * There is no quote table. The id is a fingerprint of the content (lines, coupon, fee, totals and
 * issue codes), so it changes whenever anything that matters changes and revalidation is just
 * "recompute and compare".
 */
export function buildQuote(
  state: Readonly<MockState>,
  cart: CartRecord | undefined,
  network: NetworkId,
  now: number,
): Quote {
  const issues: QuoteIssue[] = []
  const lines: Quote['lines'] = []

  for (const item of cart?.items ?? []) {
    const nft = state.nfts[item.nftId]
    const status = nft ? itemStatus(item, nft) : 'unavailable'
    if (!nft || status === 'unavailable') {
      issues.push({ code: 'UNAVAILABLE', itemId: item.id, blocking: true })
      continue
    }
    if (status === 'limited') {
      issues.push({ code: 'INSUFFICIENT_AVAILABILITY', itemId: item.id, blocking: true })
    } else if (status === 'price_changed') {
      issues.push({ code: 'PRICE_CHANGED', itemId: item.id, blocking: false })
    }
    lines.push({
      itemId: item.id,
      nftId: item.nftId,
      editionId: item.editionId,
      quantity: item.quantity,
      unitPrice: nft.price,
      lineTotal: eth.times(nft.price, item.quantity),
    })
  }

  const subtotal = purchasableSubtotal(state, cart)
  const couponRecord = cart?.couponCode ? state.coupons[cart.couponCode] : undefined
  let discount = '0'
  if (couponRecord) {
    if (Date.parse(couponRecord.expiresAt) < now) {
      issues.push({ code: 'COUPON_EXPIRED', blocking: false })
    } else if (
      couponRecord.minSubtotal !== undefined &&
      eth.cmp(subtotal, couponRecord.minSubtotal) < 0
    ) {
      issues.push({ code: 'COUPON_NOT_APPLICABLE', blocking: false })
    } else {
      // Percent coupons are whole percents, so basis points are `value × 100`.
      discount =
        couponRecord.kind === 'percent'
          ? eth.percent(subtotal, Number(couponRecord.value) * 100)
          : eth.min(couponRecord.value, subtotal)
    }
  }

  if (lines.length === 0 && !issues.some((issue) => issue.blocking)) {
    issues.push({ code: 'CART_EMPTY', blocking: true })
  }
  const empty = lines.length === 0
  const networkFee = empty ? '0' : PAYMENT_NETWORKS[network].fee
  const total = eth.add(eth.sub(subtotal, discount), networkFee)
  const coupon = couponRecord ? toCoupon(couponRecord) : null

  const id = `q_${fingerprint({
    network,
    lines: lines.map(({ itemId, nftId, editionId, quantity, unitPrice }) => [
      itemId,
      nftId,
      editionId,
      quantity,
      unitPrice,
    ]),
    coupon: coupon?.code ?? null,
    discount,
    networkFee,
    total,
    issueCodes: issues.map((issue) => `${issue.code}:${issue.itemId ?? ''}`),
  }).slice(0, 24)}`

  return {
    id,
    network,
    lines,
    subtotal,
    discount,
    networkFee,
    total,
    coupon,
    issues,
    purchasable: !issues.some((issue) => issue.blocking),
    issuedAt: new Date(now).toISOString(),
  }
}
