import { eth } from '@/lib/money'

import type { IsoDateTime } from '@/contracts'

import { COUPONS } from '../fixtures/coupons'
import { HIGHLIGHTS } from '../fixtures/highlights'
import { buildCatalog } from '../fixtures/catalog'
import { PAYMENT_NETWORKS } from '../fixtures/networks'
import { USERS, WALLETS } from '../fixtures/users'
import { sha256Hex } from '../lib/crypto'
import {
  SCHEMA_VERSION,
  type MockState,
  type NftRecord,
  type OrderRecord,
  type SeedId,
  type WalletRecord,
} from './state'

// The seed names users by their literal ids: importing the credentials file would put the plaintext
// demo passwords in the production bundle (G4). `fixtures.test.ts` ties both files together.
//
// `seed(seedId)` builds the whole database from fixed data and a seeded PRNG. It never reads the
// clock: every timestamp is a fixed ISO string, except sessions, which are created at login.

function orderLine(
  nfts: Record<string, NftRecord>,
  nftId: string,
  editionId: 'open' | 'limited-10' | 'limited-50' | 'unique',
  quantity: number,
) {
  const nft = nfts[nftId]
  const edition = nft?.editions.find((e) => e.id === editionId)
  if (!nft || !edition) throw new Error(`Seed order references ${nftId}/${editionId}`)
  return {
    nftId,
    editionId,
    name: nft.name,
    tokenId: nft.tokenId,
    editionLabel: edition.label,
    artwork: nft.artwork,
    quantity,
    unitPrice: nft.price,
    lineTotal: eth.times(nft.price, quantity),
  }
}

function collectorOf(wallet: WalletRecord) {
  return {
    displayName: wallet.displayName,
    username: 'anasouza',
    profileName: wallet.profileName,
    email: wallet.email,
    ensName: wallet.ensName,
    referralCode: wallet.referralCode,
    walletAddress: wallet.address,
    ...(wallet.alternateWallet !== undefined && { alternateWallet: wallet.alternateWallet }),
  }
}

function walletSnapshot(wallet: WalletRecord) {
  return {
    id: wallet.id,
    role: wallet.role,
    nickname: wallet.nickname,
    address: wallet.address,
    ensName: wallet.ensName,
    provider: wallet.provider,
  }
}

function confirmedOrder(nfts: Record<string, NftRecord>, wallet: WalletRecord): OrderRecord {
  const lines = [
    orderLine(nfts, 'sage-nomad-009', 'limited-10', 1),
    orderLine(nfts, 'golden-signal-160', 'open', 2),
  ]
  const subtotal = eth.add(...lines.map((line) => line.lineTotal))
  const coupon = COUPONS.find((c) => c.code === 'KURIO10')
  if (!coupon) throw new Error('Missing KURIO10')
  const discount = eth.percent(subtotal, 1000)
  const networkFee = PAYMENT_NETWORKS.ethereum.fee
  const id = 'ord_000001'
  const createdAt: IsoDateTime = '2026-09-20T15:30:00.000Z'
  const settledAt: IsoDateTime = '2026-09-20T15:30:03.000Z'
  const hash = `0x${sha256Hex(id + createdAt)}`
  return {
    id,
    userId: 'usr_ana',
    status: 'confirmed',
    lines,
    subtotal,
    discount,
    networkFee,
    total: eth.add(eth.sub(subtotal, discount), networkFee),
    coupon: {
      code: coupon.code,
      kind: coupon.kind,
      value: coupon.value,
      description: coupon.description,
    },
    network: 'ethereum',
    wallet: walletSnapshot(wallet),
    collector: collectorOf(wallet),
    note: null,
    transaction: {
      hash,
      explorerUrl: `${PAYMENT_NETWORKS.ethereum.explorerTxUrl}${hash}`,
      explorerName: PAYMENT_NETWORKS.ethereum.explorerName,
    },
    declineReason: null,
    createdAt,
    updatedAt: settledAt,
    settledAt,
    version: 2,
    settleAt: Date.parse(settledAt),
    reservations: [],
  }
}

function pendingOrder(nfts: Record<string, NftRecord>, wallet: WalletRecord): OrderRecord {
  const lines = [orderLine(nfts, 'cosmic-bloom-118', 'limited-10', 1)]
  const subtotal = eth.add(...lines.map((line) => line.lineTotal))
  const networkFee = PAYMENT_NETWORKS.ethereum.fee
  const createdAt: IsoDateTime = '2026-10-27T12:00:00.000Z'
  return {
    id: 'ord_000002',
    userId: 'usr_ana',
    status: 'pending',
    lines,
    subtotal,
    discount: '0',
    networkFee,
    total: eth.add(subtotal, networkFee),
    coupon: null,
    network: 'ethereum',
    wallet: walletSnapshot(wallet),
    collector: collectorOf(wallet),
    note: null,
    transaction: null,
    declineReason: null,
    createdAt,
    updatedAt: createdAt,
    settledAt: null,
    version: 1,
    settleAt: Date.parse(createdAt) + 3000,
    reservations: [{ nftId: 'cosmic-bloom-118', editionId: 'limited-10', quantity: 1 }],
  }
}

export function seed(seedId: SeedId = 'default'): MockState {
  const empty = seedId === 'empty-catalog'
  const catalog = Object.fromEntries(buildCatalog().map((record) => [record.id, record]))
  // Orders are self-contained snapshots, so they exist even when the catalog is empty.
  const nfts = empty ? {} : catalog

  const anaPrimary = WALLETS.find((w) => w.id === 'wal_000001')
  if (!anaPrimary) throw new Error('Missing Ana primary wallet')

  const confirmed = confirmedOrder(catalog, anaPrimary)
  const orders: MockState['orders'] = { [confirmed.id]: confirmed }
  if (seedId === 'pending-order') {
    const pending = pendingOrder(catalog, anaPrimary)
    orders[pending.id] = pending
    // The pending order holds its quantity.
    const edition = catalog['cosmic-bloom-118']?.editions.find((e) => e.id === 'limited-10')
    if (edition?.available != null) edition.available -= 1
  }

  const cartUpdatedAt: IsoDateTime = '2026-10-26T18:00:00.000Z'

  return {
    schemaVersion: SCHEMA_VERSION,
    seq: {
      user: USERS.length,
      order: seedId === 'pending-order' ? 2 : 1,
      cartItem: 2,
      wallet: WALLETS.length,
      connection: 0,
      guestCart: 0,
    },
    nfts,
    users: Object.fromEntries(USERS.map((user) => [user.id, structuredClone(user)])),
    sessions: {},
    favorites: empty
      ? {}
      : {
          usr_ana: [
            'emerald-ape-042',
            'golden-beat-207',
            'neon-vessel-552',
            'penny-pixel-001',
            'sage-nomad-009',
          ],
          usr_carla: ['cosmic-bloom-118', 'crown-relic-999'],
        },
    carts: empty
      ? {}
      : {
          'user:usr_ana': {
            id: 'cart_usr_ana',
            items: [
              {
                id: 'ci_000001',
                nftId: 'emerald-ape-042',
                editionId: 'open',
                quantity: 1,
                addedUnitPrice: '1.19',
              },
              {
                id: 'ci_000002',
                nftId: 'golden-beat-207',
                editionId: 'limited-50',
                quantity: 2,
                addedUnitPrice: '0.99',
              },
            ],
            couponCode: null,
            version: 1,
            updatedAt: cartUpdatedAt,
          },
        },
    coupons: Object.fromEntries(COUPONS.map((coupon) => [coupon.code, { ...coupon }])),
    orders,
    idempotency: {},
    wallets: Object.fromEntries(WALLETS.map((wallet) => [wallet.id, structuredClone(wallet)])),
    connections: {},
    highlights: empty ? { hero: [], featured: null } : structuredClone(HIGHLIGHTS),
    triggers: { checkoutFired: false },
  }
}
