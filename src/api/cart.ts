import {
  Cart,
  CartMergeResult,
  Quote,
  type AddCartItemBody,
  type NetworkId,
  type UpdateCartItemBody,
} from '@/contracts'

import { path, request, type ReadOptions } from './request'

export const cartApi = {
  get: (opts: ReadOptions = {}) =>
    request({ id: 'cart.get', method: 'GET', url: '/cart', response: Cart, ...opts }),
  addItem: (body: AddCartItemBody) =>
    request({ id: 'cart.addItem', method: 'POST', url: '/cart/items', data: body, response: Cart }),
  updateItem: (itemId: string, body: UpdateCartItemBody) =>
    request({
      id: 'cart.updateItem',
      method: 'PATCH',
      url: `/cart/items/${path(itemId)}`,
      data: body,
      response: Cart,
    }),
  removeItem: (itemId: string) =>
    request({
      id: 'cart.removeItem',
      method: 'DELETE',
      url: `/cart/items/${path(itemId)}`,
      response: Cart,
    }),
  applyCoupon: (code: string) =>
    request({
      id: 'cart.applyCoupon',
      method: 'PUT',
      url: '/cart/coupon',
      data: { code },
      response: Cart,
    }),
  removeCoupon: () =>
    request({ id: 'cart.removeCoupon', method: 'DELETE', url: '/cart/coupon', response: Cart }),
  merge: (guestCartId: string) =>
    request({
      id: 'cart.merge',
      method: 'POST',
      url: '/cart/merge',
      data: { guestCartId },
      response: CartMergeResult,
    }),
  quote: (network: NetworkId, opts: ReadOptions = {}) =>
    request({
      id: 'quote.get',
      method: 'GET',
      url: '/cart/quote',
      params: { network },
      response: Quote,
      ...opts,
    }),
}
