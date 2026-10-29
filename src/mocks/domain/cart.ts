import type { Cart, CartItem, CartItemStatus, CartMergeResult, EditionId } from '@/contracts'
import { eth } from '@/lib/money'

import type { CartItemRecord, CartKey, CartRecord, MockState, NftRecord } from '../db/state'
import type { Tx } from '../db/store'
import { newToken } from '../lib/crypto'
import { HttpError } from '../lib/http-error'
import { toCoupon } from './mappers'

/** `min(available ?? ∞, maxPerOrder)`: the most a line may hold. */
export function lineLimit(edition: { available: number | null; maxPerOrder: number }): number {
  return Math.min(edition.available ?? Number.POSITIVE_INFINITY, edition.maxPerOrder)
}

export function userCartKey(userId: string): CartKey {
  return `user:${userId}`
}

export function guestCartKey(guestCartId: string): CartKey {
  return `guest:${guestCartId}`
}

function findEdition(nft: NftRecord, editionId: EditionId) {
  return nft.editions.find((edition) => edition.id === editionId)
}

/** Status priority: unavailable > limited > price_changed > ok (spec 02 §8.3). */
export function itemStatus(item: CartItemRecord, nft: NftRecord): CartItemStatus {
  const edition = findEdition(nft, item.editionId)
  if (!edition || edition.available === 0) return 'unavailable'
  if (item.quantity > lineLimit(edition)) return 'limited'
  if (eth.cmp(nft.price, item.addedUnitPrice) !== 0) return 'price_changed'
  return 'ok'
}

export function toCartItem(
  item: CartItemRecord,
  nft: NftRecord,
  image: CartItem['image'],
): CartItem {
  const edition = findEdition(nft, item.editionId)
  return {
    id: item.id,
    nftId: item.nftId,
    editionId: item.editionId,
    name: nft.name,
    tokenId: nft.tokenId,
    editionLabel: edition?.label ?? '',
    image,
    quantity: item.quantity,
    unitPrice: nft.price,
    addedUnitPrice: item.addedUnitPrice,
    lineTotal: eth.times(nft.price, item.quantity),
    available: edition?.available ?? null,
    maxQuantity: edition ? lineLimit(edition) : 0,
    status: itemStatus(item, nft),
  }
}

/** Builds the wire cart; `imageOf` is injected so this module stays free of fixtures. */
export function toCart(
  state: Readonly<MockState>,
  key: CartKey | null,
  userId: string | null,
  now: number,
  imageOf: (nft: NftRecord) => CartItem['image'],
): Cart {
  const record = key ? state.carts[key] : undefined
  if (!record) {
    return {
      // A user always has a cart id; a guest has none until the first write.
      id: userId ? `cart_${userId}` : null,
      items: [],
      coupon: null,
      itemCount: 0,
      version: 0,
      updatedAt: new Date(now).toISOString(),
    }
  }
  const items = record.items.flatMap((item) => {
    const nft = state.nfts[item.nftId]
    return nft ? [toCartItem(item, nft, imageOf(nft))] : []
  })
  const coupon = record.couponCode ? state.coupons[record.couponCode] : undefined
  return {
    id: record.id,
    items,
    coupon: coupon ? toCoupon(coupon) : null,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    version: record.version,
    updatedAt: record.updatedAt,
  }
}

/**
 * Creates the cart on first write; guests get a `g_<random>` id only now. The id is the guest's
 * only credential (`X-Guest-Cart-Id`), so it is unguessable, not a counter someone could walk
 * through (R9). Nothing depends on its value: tests and baselines never show it.
 */
export function ensureCart(
  tx: Tx,
  key: CartKey | null,
  userId: string | null,
): [CartKey, CartRecord] {
  let resolved = key
  let id: string
  if (userId) {
    resolved = userCartKey(userId)
    id = `cart_${userId}`
  } else if (resolved) {
    id = resolved.slice('guest:'.length)
  } else {
    id = `g_${newToken()}`
    resolved = guestCartKey(id)
  }
  const existing = tx.state.carts[resolved]
  if (existing) return [resolved, existing]
  const created: CartRecord = {
    id,
    items: [],
    couponCode: null,
    version: 0,
    updatedAt: new Date(tx.now).toISOString(),
  }
  tx.state.carts[resolved] = created
  return [resolved, created]
}

export function touch(tx: Tx, cart: CartRecord): void {
  cart.version += 1
  cart.updatedAt = new Date(tx.now).toISOString()
}

function requireNft(state: Readonly<MockState>, nftId: string): NftRecord {
  const nft = state.nfts[nftId]
  if (!nft) throw new HttpError('NOT_FOUND', { details: { resource: 'nft' } })
  return nft
}

function assertWithinLimit(nft: NftRecord, editionId: EditionId, requested: number): void {
  const edition = findEdition(nft, editionId)
  if (!edition) throw new HttpError('NOT_FOUND', { details: { resource: 'edition' } })
  if (edition.available === 0) {
    throw new HttpError('EDITION_UNAVAILABLE', { details: { nftId: nft.id, editionId } })
  }
  const limit = lineLimit(edition)
  if (requested > limit) {
    throw new HttpError('INSUFFICIENT_AVAILABILITY', {
      details: { lines: [{ nftId: nft.id, editionId, requested, available: limit }] },
    })
  }
}

export function addItem(
  tx: Tx,
  cart: CartRecord,
  body: { nftId: string; editionId: EditionId; quantity: number },
): void {
  const nft = requireNft(tx.state, body.nftId)
  const line = cart.items.find((i) => i.nftId === body.nftId && i.editionId === body.editionId)
  assertWithinLimit(nft, body.editionId, (line?.quantity ?? 0) + body.quantity)
  if (line) {
    line.quantity += body.quantity
  } else {
    cart.items.push({
      id: `ci_${String(++tx.state.seq.cartItem).padStart(6, '0')}`,
      nftId: body.nftId,
      editionId: body.editionId,
      quantity: body.quantity,
      addedUnitPrice: nft.price,
    })
  }
  touch(tx, cart)
}

/**
 * Finds an item by id and checks it belongs to `cartKey`: another cart's item is 403 (an
 * id-addressed resource of someone else), an unknown id is 404.
 */
export function ownedItem(
  state: Readonly<MockState>,
  cartKey: CartKey | null,
  itemId: string,
): { cart: CartRecord; item: CartItemRecord } {
  for (const [key, cart] of Object.entries(state.carts)) {
    const item = cart.items.find((i) => i.id === itemId)
    if (item) {
      if (key !== cartKey) throw new HttpError('FORBIDDEN')
      return { cart, item }
    }
  }
  throw new HttpError('NOT_FOUND', { details: { resource: 'cart-item' } })
}

export function updateItem(
  tx: Tx,
  cart: CartRecord,
  item: CartItemRecord,
  body: { quantity?: number | undefined; acknowledgePrice?: true | undefined },
): void {
  const nft = requireNft(tx.state, item.nftId)
  if (body.quantity !== undefined) {
    assertWithinLimit(nft, item.editionId, body.quantity)
    item.quantity = body.quantity
  }
  if (body.acknowledgePrice) item.addedUnitPrice = nft.price
  touch(tx, cart)
}

export function removeItem(tx: Tx, cart: CartRecord, itemId: string): void {
  cart.items = cart.items.filter((item) => item.id !== itemId)
  touch(tx, cart)
}

/** Sum of `price × quantity` over lines that can be bought (unavailable lines excluded). */
export function purchasableSubtotal(
  state: Readonly<MockState>,
  cart: CartRecord | undefined,
): string {
  if (!cart) return '0'
  return eth.add(
    ...cart.items.flatMap((item) => {
      const nft = state.nfts[item.nftId]
      if (!nft || itemStatus(item, nft) === 'unavailable') return []
      return [eth.times(nft.price, item.quantity)]
    }),
  )
}

export function applyCoupon(tx: Tx, cart: CartRecord, rawCode: string): void {
  const code = rawCode.trim().toUpperCase()
  const coupon = tx.state.coupons[code]
  const couponError = (error: 'COUPON_INVALID' | 'COUPON_EXPIRED' | 'COUPON_NOT_APPLICABLE') =>
    new HttpError(error, { fields: { code: [new HttpError(error).message] } })
  if (!coupon) throw couponError('COUPON_INVALID')
  if (Date.parse(coupon.expiresAt) < tx.now) throw couponError('COUPON_EXPIRED')
  if (
    coupon.minSubtotal !== undefined &&
    eth.cmp(purchasableSubtotal(tx.state, cart), coupon.minSubtotal) < 0
  ) {
    throw couponError('COUPON_NOT_APPLICABLE')
  }
  cart.couponCode = coupon.code
  touch(tx, cart)
}

export function removeCoupon(tx: Tx, cart: CartRecord): void {
  if (cart.couponCode === null) return
  cart.couponCode = null
  touch(tx, cart)
}

/**
 * Adds the guest lines to the user's cart (summing the same NFT and edition, capped at the limit),
 * reports every adjusted line and deletes the guest cart. A cart that no longer exists is a no-op.
 */
export function mergeGuestCart(
  tx: Tx,
  userId: string,
  guestCartId: string,
): CartMergeResult['adjustments'] {
  const guestKey = guestCartKey(guestCartId)
  const guest = tx.state.carts[guestKey]
  const adjustments: CartMergeResult['adjustments'] = []
  if (!guest) return adjustments

  const [, cart] = ensureCart(tx, null, userId)
  for (const line of guest.items) {
    const nft = tx.state.nfts[line.nftId]
    const edition = nft ? findEdition(nft, line.editionId) : undefined
    if (!nft || !edition || edition.available === 0) {
      adjustments.push({
        nftId: line.nftId,
        editionId: line.editionId,
        requested: line.quantity,
        applied: 0,
        reason: 'unavailable',
      })
      continue
    }
    const existing = cart.items.find(
      (i) => i.nftId === line.nftId && i.editionId === line.editionId,
    )
    const before = existing?.quantity ?? 0
    const total = Math.min(before + line.quantity, lineLimit(edition))
    const applied = Math.max(0, total - before)
    if (applied < line.quantity) {
      adjustments.push({
        nftId: line.nftId,
        editionId: line.editionId,
        requested: line.quantity,
        applied,
        reason: 'capped',
      })
    }
    if (existing) existing.quantity = Math.max(existing.quantity, total)
    else if (applied > 0) {
      cart.items.push({
        id: `ci_${String(++tx.state.seq.cartItem).padStart(6, '0')}`,
        nftId: line.nftId,
        editionId: line.editionId,
        quantity: applied,
        addedUnitPrice: line.addedUnitPrice,
      })
    }
  }
  cart.couponCode ??= guest.couponCode
  touch(tx, cart)
  Reflect.deleteProperty(tx.state.carts, guestKey)
  return adjustments
}
