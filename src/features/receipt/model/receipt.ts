import { NETWORK_LABELS, WALLET_PROVIDER_LABELS, type Order } from '@/contracts'
import { eth, formatEth } from '@/lib/money'

import { formatOrderDate, shortHash } from './format'

export interface ReceiptLineView {
  key: string
  name: string
  tokenId: string
  editionLabel: string
  image: Order['lines'][number]['image']
  quantity: string
  total: string
}

export interface ReceiptTotalRow {
  key: 'subtotal' | 'discount' | 'fee' | 'total'
  label: string
  value: string
}

export interface ReceiptView {
  hash: string
  shortHash: string
  date: string
  total: string
  wallet: string
  lines: ReceiptLineView[]
  totals: ReceiptTotalRow[]
  note: string
  explorer: { name: string; url: string }
}

/** An order that is not confirmed has no receipt: the page never builds one (RCPT-05). */
export function isReceiptOrder(
  order: Order,
): order is Order & { transaction: NonNullable<Order['transaction']>; settledAt: string } {
  return order.status === 'confirmed' && order.transaction !== null && order.settledAt !== null
}

/**
 * Everything the receipt shows, taken from the order snapshot alone (RCPT-08): no catalog data and
 * no arithmetic, only formatting of what the server stored at confirmation (RCPT-12). The rows are
 * the receipt's own rules: "Desconto" only when the order has one, the note names the order's
 * network.
 */
export function receiptView(
  order: Order & { transaction: NonNullable<Order['transaction']>; settledAt: string },
): ReceiptView {
  const totals: ReceiptTotalRow[] = [
    { key: 'subtotal', label: 'Subtotal', value: formatEth(order.subtotal) },
  ]
  if (!eth.isZero(order.discount)) {
    totals.push({
      key: 'discount',
      label: order.coupon ? `Desconto (${order.coupon.code})` : 'Desconto',
      value: `-${formatEth(order.discount)}`,
    })
  }
  totals.push(
    { key: 'fee', label: 'Taxa de rede', value: formatEth(order.networkFee) },
    { key: 'total', label: 'Total', value: formatEth(order.total) },
  )

  return {
    hash: order.transaction.hash,
    shortHash: shortHash(order.transaction.hash),
    date: formatOrderDate(order.settledAt),
    total: formatEth(order.total),
    wallet: WALLET_PROVIDER_LABELS[order.wallet.provider],
    lines: order.lines.map((line) => ({
      key: `${line.nftId}:${line.editionId}`,
      name: line.name,
      tokenId: line.tokenId,
      editionLabel: line.editionLabel,
      image: line.image,
      quantity: `(x ${String(line.quantity)})`,
      total: formatEth(line.lineTotal),
    })),
    totals,
    note: `Transação confirmada na ${NETWORK_LABELS[order.network]}. A propriedade foi transferida para sua carteira conectada e registrada na rede.`,
    explorer: { name: order.transaction.explorerName, url: order.transaction.explorerUrl },
  }
}
