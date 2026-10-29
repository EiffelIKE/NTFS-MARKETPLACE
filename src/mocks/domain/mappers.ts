import type {
  Coupon,
  Highlights,
  NftDetail,
  NftSummary,
  Order,
  OrderSummary,
  Profile,
  User,
  Wallet,
  WalletConnection,
} from '@/contracts'

import type {
  ConnectionRecord,
  CouponRecord,
  HighlightsRecord,
  NftRecord,
  OrderRecord,
  UserRecord,
  WalletRecord,
} from '../db/state'
import { artworkImage } from '../fixtures/artworks'
import { omit } from '../lib/omit'

// Record -> wire shape. Records hold artwork keys instead of URLs (see db/state.ts), so every
// image is built here. Spec 03's event envelope reuses `toNftSummary` / `toNftDetail`, so REST and
// events can never disagree about an NFT (brief §6).

/** True while at least one edition has stock; an open edition (`null`) always has. */
export function hasStock(nft: NftRecord): boolean {
  return nft.editions.some((edition) => edition.available === null || edition.available > 0)
}

export function toNftSummary(nft: NftRecord): NftSummary {
  return {
    id: nft.id,
    name: nft.name,
    collection: nft.collection,
    category: nft.category,
    network: nft.network,
    image: artworkImage(nft.artwork, nft.name),
    price: nft.price,
    ...(nft.previousPrice !== undefined && { previousPrice: nft.previousPrice }),
    rarity: nft.rarity,
    available: hasStock(nft),
    listedAt: nft.listedAt,
    version: nft.version,
  }
}

export function toNftDetail(nft: NftRecord): NftDetail {
  return {
    ...toNftSummary(nft),
    description: nft.description,
    longDescription: nft.longDescription,
    tokenId: nft.tokenId,
    creator: nft.creator,
    attributes: nft.attributes,
    specs: nft.specs,
    royaltyBps: nft.royaltyBps,
    images: nft.gallery.map((key) => artworkImage(key, nft.name)),
    editions: nft.editions,
    rating: nft.rating,
    reviewCount: nft.reviewCount,
    reviews: nft.reviews,
  }
}

export function toHighlights(highlights: HighlightsRecord): Highlights {
  return {
    hero: highlights.hero.map(({ artwork, ...slide }) => ({
      ...slide,
      image: artworkImage(artwork),
    })),
    featured: highlights.featured
      ? {
          nftId: highlights.featured.nftId,
          title: highlights.featured.title,
          subtitle: highlights.featured.subtitle,
          image: artworkImage(highlights.featured.artwork),
        }
      : null,
  }
}

export function toUser(user: UserRecord): User {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    email: user.email,
    avatarUrl: user.avatarUrl,
  }
}

export function toProfile(user: UserRecord): Profile {
  return {
    id: user.id,
    displayName: user.displayName,
    username: user.username,
    email: user.email,
    ensName: user.ensName,
    walletNickname: user.walletNickname,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
  }
}

export function toCoupon(coupon: CouponRecord): Coupon {
  return {
    code: coupon.code,
    kind: coupon.kind,
    value: coupon.value,
    description: coupon.description,
  }
}

export function toWallet(record: WalletRecord): Wallet {
  return omit(record, 'userId')
}

export function toConnection(record: ConnectionRecord): WalletConnection {
  return omit(record, 'userId')
}

export function toOrder(record: OrderRecord): Order {
  const { lines, ...order } = omit(record, 'userId', 'settleAt', 'reservations')
  return {
    ...order,
    lines: lines.map(({ artwork, ...line }) => ({
      ...line,
      image: artworkImage(artwork, line.name),
    })),
  }
}

export function toOrderSummary(record: OrderRecord): OrderSummary {
  return {
    id: record.id,
    status: record.status,
    total: record.total,
    network: record.network,
    createdAt: record.createdAt,
    version: record.version,
    itemCount: record.lines.reduce((sum, line) => sum + line.quantity, 0),
  }
}
