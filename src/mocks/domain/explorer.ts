import { eth } from '@/lib/money'
import type { ExplorerTransaction, NetworkId } from '@/contracts'

import type { OrderRecord } from '../db/state'
import { MARKETPLACE_CONTRACTS, PAYMENT_NETWORKS } from '../fixtures/networks'

/** First block of the simulated chains; the rest is derived from the hash. */
const FIRST_BLOCK: Record<NetworkId, number> = {
  ethereum: 19_500_000,
  polygon: 58_000_000,
  solana: 280_000_000,
}
const BLOCK_SPAN = 500_000

/** Deterministic: the same hash always lands in the same block (the first 32 bits of the hash). */
export function blockNumberOf(network: NetworkId, hash: string): number {
  const bits = Number.parseInt(hash.replace(/^0x/, '').slice(0, 8), 16)
  return FIRST_BLOCK[network] + ((Number.isNaN(bits) ? 0 : bits) % BLOCK_SPAN)
}

/**
 * The order whose recorded transaction is `hash` on `network`, whoever owns it: a chain is public.
 * Only a confirmed order has a hash, so nothing else can be looked up.
 */
export function findTransactionOrder(
  orders: Record<string, OrderRecord>,
  network: NetworkId,
  hash: string,
): OrderRecord | undefined {
  const wanted = hash.toLowerCase()
  return Object.values(orders).find(
    (order) => order.network === network && order.transaction?.hash.toLowerCase() === wanted,
  )
}

/** The public projection of an order's transaction: no collector, e-mail or wallet nickname. */
export function toExplorerTransaction(order: OrderRecord): ExplorerTransaction | null {
  const { transaction, settledAt } = order
  if (!transaction || !settledAt) return null
  return {
    hash: transaction.hash,
    network: order.network,
    explorerName: PAYMENT_NETWORKS[order.network].explorerName,
    status: order.status,
    blockNumber: blockNumberOf(order.network, transaction.hash),
    timestamp: settledAt,
    from: order.wallet.address,
    to: MARKETPLACE_CONTRACTS[order.network],
    value: eth.sub(order.total, order.networkFee),
    networkFee: order.networkFee,
    items: order.lines.map(({ name, tokenId, editionLabel, quantity }) => ({
      name,
      tokenId,
      editionLabel,
      quantity,
    })),
  }
}
