import type { CreateOrderBody, Quote } from '@/contracts'
import { eth } from '@/lib/money'

import type { MockConfig } from '../config'
import type { Tx } from '../db/store'
import type { MockState, NftRecord, OrderRecord, Reservation } from '../db/state'
import { PAYMENT_NETWORKS } from '../fixtures/networks'
import { fingerprint, sha256Hex } from '../lib/crypto'
import { HttpError } from '../lib/http-error'
import { userCartKey } from './cart'
import { isConnected, ownedWallet } from './wallets'
import { buildQuote } from './quote'

/** Bumps an NFT's version after a price or availability change and publishes `nft.updated`. */
export function bumpNft(tx: Tx, nft: NftRecord): void {
  nft.version += 1
  tx.emit({ type: 'nft.updated', nftId: nft.id, version: nft.version })
}

function emitOrder(tx: Tx, order: OrderRecord): void {
  tx.emit({
    type: 'order.updated',
    orderId: order.id,
    userId: order.userId,
    version: order.version,
  })
}

export function pendingOrderOf(
  state: Readonly<MockState>,
  userId: string,
): OrderRecord | undefined {
  return Object.values(state.orders).find(
    (order) => order.userId === userId && order.status === 'pending',
  )
}

/** Steps 1–4 of creation (spec 02 §8.4): the replay, the conflict and the pending check. */
export function checkIdempotency(
  state: Readonly<MockState>,
  userId: string,
  key: string,
  body: CreateOrderBody,
): OrderRecord | null {
  const record = state.idempotency[`${userId}:${key}`]
  if (record) {
    if (record.fingerprint !== fingerprint(body)) {
      throw new HttpError('IDEMPOTENCY_CONFLICT', { details: { orderId: record.orderId } })
    }
    const order = state.orders[record.orderId]
    if (order) return order
  }
  const pending = pendingOrderOf(state, userId)
  if (pending) throw new HttpError('ORDER_PENDING', { details: { orderId: pending.id } })
  return null
}

/** Step 4: the wallet must be the user's, support the network and be connected. */
export function validateWallet(state: Readonly<MockState>, userId: string, body: CreateOrderBody) {
  const wallet = ownedWallet(state, userId, body.walletId)
  if (PAYMENT_NETWORKS[body.network].walletFamily !== wallet.family) {
    throw new HttpError('VALIDATION_FAILED', {
      fields: { network: ['Esta carteira não suporta a rede selecionada.'] },
    })
  }
  if (!isConnected(state, userId, wallet.id, body.provider, body.network)) {
    throw new HttpError('WALLET_NOT_CONNECTED', {
      details: { walletId: wallet.id, network: body.network },
    })
  }
  return wallet
}

/**
 * The scenario's checkout trigger, once per seed (step 5): it changes the catalog right before
 * revalidation, so the order fails with `QUOTE_CHANGED` or `INSUFFICIENT_AVAILABILITY`.
 */
export function fireCheckoutTrigger(tx: Tx, userId: string, config: MockConfig): void {
  if (!config.checkoutTrigger || tx.state.triggers.checkoutFired) return
  const cart = tx.state.carts[userCartKey(userId)]
  const first = cart?.items[0]
  const nft = first ? tx.state.nfts[first.nftId] : undefined
  if (!first || !nft) return
  tx.state.triggers.checkoutFired = true
  if (config.checkoutTrigger === 'raise-price') {
    // +10%, rounded to 4 decimals (down).
    nft.price = eth.round(eth.add(nft.price, eth.percent(nft.price, 1000)), 4)
  } else {
    // The line's own edition runs out (an open edition included).
    const edition = nft.editions.find((e) => e.id === first.editionId)
    if (edition) edition.available = 0
  }
  bumpNft(tx, nft)
}

/** Step 6: recompute the quote; anything that changed creates nothing. */
export function revalidate(
  state: Readonly<MockState>,
  userId: string,
  body: CreateOrderBody,
  now: number,
): Quote {
  const cart = state.carts[userCartKey(userId)]
  const quote = buildQuote(state, cart, body.network, now)
  const availability = quote.issues.filter(
    (issue) =>
      issue.blocking &&
      (issue.code === 'UNAVAILABLE' || issue.code === 'INSUFFICIENT_AVAILABILITY'),
  )
  if (availability.length > 0) {
    throw new HttpError('INSUFFICIENT_AVAILABILITY', {
      details: {
        lines: availability.flatMap((issue) => {
          const item = cart?.items.find((i) => i.id === issue.itemId)
          const nft = item ? state.nfts[item.nftId] : undefined
          const edition = nft?.editions.find((e) => e.id === item?.editionId)
          return item
            ? [
                {
                  nftId: item.nftId,
                  editionId: item.editionId,
                  requested: item.quantity,
                  available: Math.min(edition?.available ?? 0, edition?.maxPerOrder ?? 0),
                },
              ]
            : []
        }),
      },
    })
  }
  if (quote.id !== body.quoteId || !quote.purchasable) {
    throw new HttpError('QUOTE_CHANGED', { details: { quote } })
  }
  return quote
}

/** Steps 7–8: snapshot, reserve stock, remember the key. */
export function createOrder(
  tx: Tx,
  userId: string,
  key: string,
  body: CreateOrderBody,
  quote: Quote,
  config: MockConfig,
): OrderRecord {
  const wallet = ownedWallet(tx.state, userId, body.walletId)
  const cart = tx.state.carts[userCartKey(userId)]
  const network = PAYMENT_NETWORKS[body.network]
  const now = new Date(tx.now).toISOString()
  const id = `ord_${String(++tx.state.seq.order).padStart(6, '0')}`

  const reservations: Reservation[] = []
  const lines = quote.lines.map((line) => {
    const item = cart?.items.find((i) => i.id === line.itemId)
    const nft = tx.state.nfts[line.nftId]
    const edition = nft?.editions.find((e) => e.id === line.editionId)
    if (!item || !nft || !edition) throw new HttpError('QUOTE_CHANGED', { details: { quote } })
    if (edition.available !== null) {
      edition.available -= line.quantity
      reservations.push({ nftId: nft.id, editionId: edition.id, quantity: line.quantity })
      bumpNft(tx, nft)
    }
    return {
      nftId: nft.id,
      editionId: edition.id,
      name: nft.name,
      tokenId: nft.tokenId,
      editionLabel: edition.label,
      artwork: nft.artwork,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      lineTotal: line.lineTotal,
    }
  })

  const order: OrderRecord = {
    id,
    userId,
    status: 'pending',
    lines,
    subtotal: quote.subtotal,
    discount: quote.discount,
    networkFee: quote.networkFee,
    total: quote.total,
    coupon: quote.coupon,
    network: network.id,
    wallet: {
      id: wallet.id,
      role: wallet.role,
      nickname: wallet.nickname,
      address: wallet.address,
      ensName: wallet.ensName,
      provider: body.provider,
    },
    collector: body.collector,
    note: body.note ?? null,
    transaction: null,
    declineReason: null,
    createdAt: now,
    updatedAt: now,
    settledAt: null,
    version: 1,
    settleAt: tx.now + config.payment.settleDelayMs,
    reservations,
  }
  tx.state.orders[id] = order
  tx.state.idempotency[`${userId}:${key}`] = { fingerprint: fingerprint(body), orderId: id }
  emitOrder(tx, order)
  return order
}

/** Moves a pending order to a terminal state; both states are final (API-24). */
export function settleOrder(tx: Tx, order: OrderRecord, outcome: 'confirmed' | 'declined'): void {
  if (order.status !== 'pending') throw new Error(`Order ${order.id} is already ${order.status}`)
  const at = new Date(tx.now).toISOString()
  order.status = outcome
  order.settledAt = at
  order.updatedAt = at
  order.version += 1

  if (outcome === 'confirmed') {
    const hash = `0x${sha256Hex(order.id + order.createdAt)}`
    const network = PAYMENT_NETWORKS[order.network]
    order.transaction = {
      hash,
      explorerUrl: `${network.explorerTxUrl}${hash}`,
      explorerName: network.explorerName,
    }
    // Only the purchased quantities leave the buyer's current cart.
    const cart = tx.state.carts[userCartKey(order.userId)]
    if (cart) {
      for (const line of order.lines) {
        const item = cart.items.find(
          (i) => i.nftId === line.nftId && i.editionId === line.editionId,
        )
        if (item) item.quantity -= line.quantity
      }
      cart.items = cart.items.filter((item) => item.quantity > 0)
      cart.version += 1
      cart.updatedAt = at
    }
  } else {
    order.declineReason = { code: 'PAYMENT_DECLINED', message: 'A carteira recusou o pagamento.' }
    // Release the reservations, capped at supply.
    for (const reservation of order.reservations) {
      const nft = tx.state.nfts[reservation.nftId]
      const edition = nft?.editions.find((e) => e.id === reservation.editionId)
      if (nft && edition && edition.available !== null) {
        edition.available = Math.min(
          edition.supply ?? Infinity,
          edition.available + reservation.quantity,
        )
        bumpNft(tx, nft)
      }
    }
  }
  emitOrder(tx, order)
}

/** Settles every pending order that is due, unless the scenario settles by hand. */
export function settleDue(tx: Tx, config: MockConfig): number {
  if (config.payment.outcome === 'manual') return 0
  const outcome = config.payment.outcome === 'confirm' ? 'confirmed' : 'declined'
  let settled = 0
  for (const order of Object.values(tx.state.orders)) {
    if (order.status === 'pending' && order.settleAt <= tx.now) {
      settleOrder(tx, order, outcome)
      settled += 1
    }
  }
  return settled
}

/** Earliest `settleAt` among pending orders, or `null`. */
export function nextSettlement(state: Readonly<MockState>, config: MockConfig): number | null {
  if (config.payment.outcome === 'manual') return null
  let earliest: number | null = null
  for (const order of Object.values(state.orders)) {
    if (order.status === 'pending' && (earliest === null || order.settleAt < earliest)) {
      earliest = order.settleAt
    }
  }
  return earliest
}
