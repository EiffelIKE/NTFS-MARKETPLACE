import {
  AddCartItemBody,
  CouponBody,
  MergeCartBody,
  QuoteQuery,
  UpdateCartItemBody,
  type OperationId,
} from '@/contracts'

import type { CartKey, MockState } from '../db/state'
import {
  addItem,
  applyCoupon,
  ensureCart,
  guestCartKey,
  mergeGuestCart,
  ownedItem,
  removeCoupon,
  removeItem,
  toCart,
  updateItem,
  userCartKey,
} from '../domain/cart'
import { buildQuote } from '../domain/quote'
import { artworkImage } from '../fixtures/artworks'
import { ok, op, type AnyOp, type Ctx } from './pipeline'

interface Target {
  key: CartKey | null
  userId: string | null
}

/** A signed-in user has `user:<id>`; a guest only the cart named by `X-Guest-Cart-Id`, if it exists. */
function targetOf(ctx: Pick<Ctx<never, never>, 'session' | 'guestCartId' | 'runtime'>): Target {
  if (ctx.session) return { key: userCartKey(ctx.session.user.id), userId: ctx.session.user.id }
  const key = ctx.guestCartId ? guestCartKey(ctx.guestCartId) : null
  // A guest id that no longer exists (after a reset) is treated as "no cart yet".
  const exists = key !== null && ctx.runtime.store.read((state) => key in state.carts)
  return { key: exists ? key : null, userId: null }
}

const view = (
  state: Readonly<MockState>,
  key: CartKey | null,
  userId: string | null,
  now: number,
) => toCart(state, key, userId, now, (nft) => artworkImage(nft.artwork, nft.name))

export const cartOps = {
  'cart.get': op({
    handle(ctx) {
      const { key, userId } = targetOf(ctx)
      return ok(ctx.runtime.store.read((state) => view(state, key, userId, Date.now())))
    },
  }),

  'cart.addItem': op({
    body: AddCartItemBody,
    handle(ctx) {
      const target = targetOf(ctx)
      return ok(
        ctx.runtime.store.write((tx) => {
          const [key, cart] = ensureCart(tx, target.key, target.userId)
          addItem(tx, cart, ctx.body)
          return view(tx.state, key, target.userId, tx.now)
        }),
      )
    },
  }),

  'cart.updateItem': op({
    body: UpdateCartItemBody,
    handle(ctx) {
      const target = targetOf(ctx)
      return ok(
        ctx.runtime.store.write((tx) => {
          const { cart, item } = ownedItem(tx.state, target.key, ctx.params.itemId ?? '')
          updateItem(tx, cart, item, ctx.body)
          return view(tx.state, target.key, target.userId, tx.now)
        }),
      )
    },
  }),

  'cart.removeItem': op({
    handle(ctx) {
      const target = targetOf(ctx)
      return ok(
        ctx.runtime.store.write((tx) => {
          const { cart } = ownedItem(tx.state, target.key, ctx.params.itemId ?? '')
          removeItem(tx, cart, ctx.params.itemId ?? '')
          return view(tx.state, target.key, target.userId, tx.now)
        }),
      )
    },
  }),

  'cart.applyCoupon': op({
    body: CouponBody,
    handle(ctx) {
      const target = targetOf(ctx)
      return ok(
        ctx.runtime.store.write((tx) => {
          const [key, cart] = ensureCart(tx, target.key, target.userId)
          applyCoupon(tx, cart, ctx.body.code)
          return view(tx.state, key, target.userId, tx.now)
        }),
      )
    },
  }),

  /** Always succeeds, even without a cart or a coupon. */
  'cart.removeCoupon': op({
    handle(ctx) {
      const target = targetOf(ctx)
      return ok(
        ctx.runtime.store.write((tx) => {
          const cart = target.key ? tx.state.carts[target.key] : undefined
          if (cart) removeCoupon(tx, cart)
          return view(tx.state, target.key, target.userId, tx.now)
        }),
      )
    },
  }),

  'cart.merge': op({
    body: MergeCartBody,
    handle(ctx) {
      const { id } = ctx.user()
      return ok(
        ctx.runtime.store.write((tx) => {
          const adjustments = mergeGuestCart(tx, id, ctx.body.guestCartId)
          return { cart: view(tx.state, userCartKey(id), id, tx.now), adjustments }
        }),
      )
    },
  }),

  'quote.get': op({
    query: QuoteQuery,
    handle(ctx) {
      const { key } = targetOf(ctx)
      return ok(
        ctx.runtime.store.read((state) =>
          buildQuote(state, key ? state.carts[key] : undefined, ctx.query.network, Date.now()),
        ),
      )
    },
  }),
} satisfies Partial<Record<OperationId, AnyOp>>
