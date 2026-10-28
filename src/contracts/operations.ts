// The operation table shared by `api/` (client) and `mocks/` (server): one entry per REST call
// of brief §5. Paths are relative to `VITE_API_BASE_URL`.

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

/**
 * - `none`: no session involved;
 * - `optional`: a valid bearer is used when sent, an invalid one is a 401;
 * - `lenient`: a valid bearer is used when sent, an invalid one is ignored (logout);
 * - `required`: bearer required;
 * - `cart`: bearer, or else the `X-Guest-Cart-Id` header (a guest has a cart too).
 */
export type AuthMode = 'none' | 'optional' | 'lenient' | 'required' | 'cart'

interface OperationSpec {
  readonly method: HttpMethod
  readonly path: string
  readonly auth: AuthMode
}

export const OPERATIONS = {
  'auth.signup': { method: 'POST', path: '/auth/signup', auth: 'none' },
  'auth.login': { method: 'POST', path: '/auth/login', auth: 'none' },
  'auth.session': { method: 'GET', path: '/auth/session', auth: 'required' },
  'auth.logout': { method: 'POST', path: '/auth/logout', auth: 'lenient' },
  'nfts.list': { method: 'GET', path: '/nfts', auth: 'optional' },
  'nfts.get': { method: 'GET', path: '/nfts/:nftId', auth: 'none' },
  'nfts.related': { method: 'GET', path: '/nfts/:nftId/related', auth: 'none' },
  'highlights.get': { method: 'GET', path: '/highlights', auth: 'none' },
  'networks.list': { method: 'GET', path: '/networks', auth: 'none' },
  'favorites.list': { method: 'GET', path: '/favorites', auth: 'required' },
  'favorites.add': { method: 'PUT', path: '/favorites/:nftId', auth: 'required' },
  'favorites.remove': { method: 'DELETE', path: '/favorites/:nftId', auth: 'required' },
  'cart.get': { method: 'GET', path: '/cart', auth: 'cart' },
  'cart.addItem': { method: 'POST', path: '/cart/items', auth: 'cart' },
  'cart.updateItem': { method: 'PATCH', path: '/cart/items/:itemId', auth: 'cart' },
  'cart.removeItem': { method: 'DELETE', path: '/cart/items/:itemId', auth: 'cart' },
  'cart.applyCoupon': { method: 'PUT', path: '/cart/coupon', auth: 'cart' },
  'cart.removeCoupon': { method: 'DELETE', path: '/cart/coupon', auth: 'cart' },
  'cart.merge': { method: 'POST', path: '/cart/merge', auth: 'required' },
  'quote.get': { method: 'GET', path: '/cart/quote', auth: 'cart' },
  'orders.create': { method: 'POST', path: '/orders', auth: 'required' },
  'orders.get': { method: 'GET', path: '/orders/:orderId', auth: 'required' },
  'orders.list': { method: 'GET', path: '/orders', auth: 'required' },
  'profile.get': { method: 'GET', path: '/profile', auth: 'required' },
  'profile.update': { method: 'PUT', path: '/profile', auth: 'required' },
  'profile.uploadAvatar': { method: 'PUT', path: '/profile/avatar', auth: 'required' },
  'profile.removeAvatar': { method: 'DELETE', path: '/profile/avatar', auth: 'required' },
  'profile.changePassword': { method: 'PUT', path: '/profile/password', auth: 'required' },
  'wallets.list': { method: 'GET', path: '/wallets', auth: 'required' },
  'wallets.create': { method: 'POST', path: '/wallets', auth: 'required' },
  'wallets.update': { method: 'PUT', path: '/wallets/:walletId', auth: 'required' },
  'walletConnections.list': { method: 'GET', path: '/wallet-connections', auth: 'required' },
  'walletConnections.connect': { method: 'POST', path: '/wallet-connections', auth: 'required' },
  'walletConnections.disconnect': {
    method: 'DELETE',
    path: '/wallet-connections/:connectionId',
    auth: 'required',
  },
} as const satisfies Record<string, OperationSpec>

export type OperationId = keyof typeof OPERATIONS

export const OPERATION_IDS = Object.keys(OPERATIONS) as OperationId[]

export const AUTHORIZATION_HEADER = 'Authorization'
export const GUEST_CART_HEADER = 'X-Guest-Cart-Id'
export const IDEMPOTENCY_HEADER = 'Idempotency-Key'
