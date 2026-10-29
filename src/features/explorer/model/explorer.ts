import { NETWORK_LABELS, type ExplorerTransaction, type ExplorerTxStatus } from '@/contracts'
import { formatEth } from '@/lib/money'

const TIME = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'medium' })
const BLOCK = new Intl.NumberFormat('pt-BR')

export const STATUS_LABELS: Record<ExplorerTxStatus, string> = {
  confirmed: 'Confirmada',
  pending: 'Pendente',
  declined: 'Recusada',
}

export interface ExplorerView {
  hash: string
  network: string
  explorerName: string
  status: { value: ExplorerTxStatus; label: string }
  block: string
  time: string
  from: string
  to: string
  value: string
  fee: string
  items: { key: string; name: string; tokenId: string; editionLabel: string; quantity: string }[]
}

/** Everything the page shows, formatted from the public transaction alone (no arithmetic). */
export function explorerView(tx: ExplorerTransaction): ExplorerView {
  return {
    hash: tx.hash,
    network: NETWORK_LABELS[tx.network],
    explorerName: tx.explorerName,
    status: { value: tx.status, label: STATUS_LABELS[tx.status] },
    block: BLOCK.format(tx.blockNumber),
    time: TIME.format(new Date(tx.timestamp)),
    from: tx.from,
    to: tx.to,
    value: formatEth(tx.value),
    fee: formatEth(tx.networkFee),
    items: tx.items.map((item, index) => ({
      key: `${item.tokenId}:${item.editionLabel}:${String(index)}`,
      name: item.name,
      tokenId: item.tokenId,
      editionLabel: item.editionLabel,
      quantity: `x ${String(item.quantity)}`,
    })),
  }
}
