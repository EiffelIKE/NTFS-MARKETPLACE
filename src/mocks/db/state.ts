import type {
  CategoryId,
  EditionId,
  Eth,
  IsoDateTime,
  NetworkId,
  NftId,
  Order,
  OrderLine,
  Rarity,
  Wallet,
  WalletConnection,
} from '@/contracts'

// The typed mock database (spec 02 §7). Everything here is plain JSON, so it persists in
// `localStorage` as is. Images are stored as artwork keys, never URLs: URLs are fingerprinted per
// build, and a persisted state must survive a redeploy.

export type UserId = string
export type OrderId = string
export type WalletId = string
export type ConnectionId = string
export type Token = string
export type CartKey = `user:${string}` | `guest:${string}`
export type ArtworkKey =
  'ape-varsity' | 'gorilla-bucket-hat' | 'gorilla-turtleneck' | 'ape-headphones'

export interface EditionRecord {
  id: EditionId
  label: '1/1' | '1/10' | '1/50' | 'ABERTA'
  supply: number | null
  /** After pending reservations; `null` for an open edition. */
  available: number | null
  maxPerOrder: number
}

export interface NftRecord {
  id: NftId
  name: string
  collection: { id: string; name: string }
  category: CategoryId
  network: NetworkId
  artwork: ArtworkKey
  gallery: ArtworkKey[]
  price: Eth
  previousPrice?: Eth
  rarity: Rarity
  listedAt: IsoDateTime
  trendingScore: number
  version: number
  description: string
  longDescription: string[]
  tokenId: string
  creator: { name: string; username: string }
  attributes: string[]
  specs: {
    network: string
    royalty: string
    contract: { address: string; standard: 'ERC-721' | 'SPL' }
  }
  royaltyBps: number
  editions: EditionRecord[]
  rating: number
  reviewCount: number
  reviews: { id: string; author: string; rating: number; comment: string; createdAt: IsoDateTime }[]
}

export interface UserRecord {
  id: UserId
  username: string
  displayName: string
  /** Stored trimmed and lower-case. */
  email: string
  avatarUrl: string | null
  ensName: string | null
  walletNickname: string | null
  createdAt: IsoDateTime
  /** PBKDF2 hash; the only password material that is ever stored (API-31). */
  passwordHash: string
}

export interface SessionRecord {
  userId: UserId
  createdAt: number
  expiresAt: number
}

export interface CartItemRecord {
  id: string
  nftId: NftId
  editionId: EditionId
  quantity: number
  addedUnitPrice: Eth
}

export interface CartRecord {
  id: string
  items: CartItemRecord[]
  couponCode: string | null
  version: number
  updatedAt: IsoDateTime
}

export interface CouponRecord {
  code: string
  kind: 'percent' | 'fixed'
  value: string
  minSubtotal?: Eth
  expiresAt: IsoDateTime
  description: string
}

export interface Reservation {
  nftId: NftId
  editionId: EditionId
  quantity: number
}

export type OrderLineRecord = Omit<OrderLine, 'image'> & { artwork: ArtworkKey }

export interface OrderRecord extends Omit<Order, 'lines'> {
  userId: UserId
  lines: OrderLineRecord[]
  /** Epoch ms after which the order settles (API-24). */
  settleAt: number
  reservations: Reservation[]
}

export type WalletRecord = Wallet & { userId: UserId }
export type ConnectionRecord = WalletConnection & { userId: UserId }

export interface HeroSlideRecord {
  id: string
  nftId: NftId
  eyebrow: string
  title: string
  shortTitle: string
  description: string
  shortDescription: string
  artwork: ArtworkKey
}

export interface HighlightsRecord {
  hero: HeroSlideRecord[]
  featured: { nftId: NftId; title: string; subtitle: string; artwork: ArtworkKey } | null
}

export const SCHEMA_VERSION = 2

export interface MockState {
  schemaVersion: typeof SCHEMA_VERSION
  seq: {
    user: number
    order: number
    cartItem: number
    wallet: number
    connection: number
    guestCart: number
  }
  nfts: Record<NftId, NftRecord>
  users: Record<UserId, UserRecord>
  sessions: Record<Token, SessionRecord>
  favorites: Record<UserId, NftId[]>
  carts: Record<CartKey, CartRecord>
  coupons: Record<string, CouponRecord>
  orders: Record<OrderId, OrderRecord>
  idempotency: Record<string, { fingerprint: string; orderId: OrderId }>
  wallets: Record<WalletId, WalletRecord>
  connections: Record<ConnectionId, ConnectionRecord>
  highlights: HighlightsRecord
  /** One-shot scenario triggers (§10). */
  triggers: { checkoutFired: boolean }
}

export type SeedId = 'default' | 'empty-catalog' | 'pending-order'
