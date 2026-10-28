import { z } from 'zod'

import { Coupon } from './cart'
import { EditionId } from './catalog'
import { Eth, IsoDateTime, NetworkId, NftId } from './common'

export const QuoteQuery = z.object({ network: NetworkId })
export type QuoteQuery = z.infer<typeof QuoteQuery>

export const QuoteIssueCode = z.enum([
  'UNAVAILABLE',
  'INSUFFICIENT_AVAILABILITY',
  'PRICE_CHANGED',
  'COUPON_EXPIRED',
  'COUPON_NOT_APPLICABLE',
  'CART_EMPTY',
])
export type QuoteIssueCode = z.infer<typeof QuoteIssueCode>

export const QuoteIssue = z.object({
  code: QuoteIssueCode,
  itemId: z.string().optional(),
  blocking: z.boolean(),
})
export type QuoteIssue = z.infer<typeof QuoteIssue>

export const Quote = z.object({
  /** Content fingerprint: it changes whenever any amount, line, coupon or issue changes. */
  id: z.string(),
  network: NetworkId,
  lines: z.array(
    z.object({
      itemId: z.string(),
      nftId: NftId,
      editionId: EditionId,
      quantity: z.int(),
      unitPrice: Eth,
      lineTotal: Eth,
    }),
  ),
  subtotal: Eth,
  discount: Eth,
  networkFee: Eth,
  /** `subtotal − discount + networkFee`, exactly. */
  total: Eth,
  coupon: Coupon.nullable(),
  issues: z.array(QuoteIssue),
  /** True when no issue is blocking. */
  purchasable: z.boolean(),
  issuedAt: IsoDateTime,
})
export type Quote = z.infer<typeof Quote>
