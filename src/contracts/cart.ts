import { z } from 'zod'

import { EditionId } from './catalog'
import { Eth, Image, IsoDateTime, NftId, Quantity } from './common'

export const AddCartItemBody = z.object({ nftId: NftId, editionId: EditionId, quantity: Quantity })
export type AddCartItemBody = z.infer<typeof AddCartItemBody>

export const UpdateCartItemBody = z
  .object({ quantity: Quantity.optional(), acknowledgePrice: z.literal(true).optional() })
  .refine((body) => body.quantity !== undefined || body.acknowledgePrice !== undefined, {
    error: 'Informe a quantidade ou confirme o novo preço.',
  })
export type UpdateCartItemBody = z.infer<typeof UpdateCartItemBody>

export const CouponBody = z.object({
  code: z
    .string({ error: 'Informe o cupom.' })
    .trim()
    .min(1, 'Informe o cupom.')
    .max(32, 'Use no máximo 32 caracteres.'),
})
export type CouponBody = z.infer<typeof CouponBody>

export const MergeCartBody = z.object({ guestCartId: z.string().min(1) })
export type MergeCartBody = z.infer<typeof MergeCartBody>

export const Coupon = z.object({
  code: z.string(),
  kind: z.enum(['percent', 'fixed']),
  /** Whole percent for `percent`, an ETH amount for `fixed`. */
  value: z.string(),
  description: z.string(),
})
export type Coupon = z.infer<typeof Coupon>

export const CartItemStatus = z.enum(['ok', 'price_changed', 'limited', 'unavailable'])
export type CartItemStatus = z.infer<typeof CartItemStatus>

export const CartItem = z.object({
  id: z.string(),
  nftId: NftId,
  editionId: EditionId,
  name: z.string(),
  tokenId: z.string(),
  editionLabel: z.string(),
  image: Image,
  quantity: z.int(),
  unitPrice: Eth,
  addedUnitPrice: Eth,
  /** Shown per row; the summary totals still come only from the quote. */
  lineTotal: Eth,
  available: z.int().nullable(),
  maxQuantity: z.int(),
  status: CartItemStatus,
})
export type CartItem = z.infer<typeof CartItem>

export const Cart = z.object({
  /** `null` for a guest who has no cart yet. */
  id: z.string().nullable(),
  items: z.array(CartItem),
  coupon: Coupon.nullable(),
  itemCount: z.int(),
  version: z.int(),
  updatedAt: IsoDateTime,
})
export type Cart = z.infer<typeof Cart>

export const CartMergeResult = z.object({
  cart: Cart,
  adjustments: z.array(
    z.object({
      nftId: NftId,
      editionId: EditionId,
      requested: z.int(),
      applied: z.int(),
      reason: z.enum(['capped', 'unavailable']),
    }),
  ),
})
export type CartMergeResult = z.infer<typeof CartMergeResult>
