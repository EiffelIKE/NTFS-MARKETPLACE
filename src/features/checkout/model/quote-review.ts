import type { CartItem, Eth, Quote } from '@/contracts'
import { eth } from '@/lib/money'

/**
 * The review step's logic, free of React (spec 09 design §5). The user reviews a quote and
 * *accepts* it; whenever the quote the API now holds is another one (a different `id`), they must
 * look at the new values and accept again before anything can be sent (CHK-20).
 */
export type ReviewPhase =
  /** The first quote of this review has not arrived yet. */
  | 'loading'
  /** The current quote has a blocking issue: payment is off (CHK-21). */
  | 'blocked'
  /** The current quote differs from the accepted one: "Aceitar novos valores" (CHK-20). */
  | 'changed'
  /** The accepted quote is the current quote and nothing blocks it. */
  | 'ready'

export function reviewPhase({
  accepted,
  current,
}: {
  accepted: Quote | null
  current: Quote | undefined
}): ReviewPhase {
  if (!accepted || !current) return 'loading'
  if (!current.purchasable) return 'blocked'
  return current.id === accepted.id ? 'ready' : 'changed'
}

export interface AmountChange {
  from: Eth
  to: Eth
}

export interface LineChange {
  unitPrice?: AmountChange
  quantity?: { from: number; to: number }
  lineTotal?: AmountChange
  /** The line is not in the accepted quote. */
  added?: true
}

export type TotalKey = 'subtotal' | 'discount' | 'networkFee' | 'total'

export interface QuoteDiff {
  /** Keyed by `itemId`; only lines that differ are present. */
  lines: ReadonlyMap<string, LineChange>
  /** Lines of the accepted quote that the new one no longer has. */
  removed: readonly Quote['lines'][number][]
  totals: Partial<Record<TotalKey, AmountChange>>
  /** `null` when the coupon is the same. */
  coupon: { from: string | null; to: string | null } | null
  /** Whether anything differs at all. */
  changed: boolean
}

const differs = (from: Eth, to: Eth): AmountChange | undefined =>
  eth.cmp(from, to) === 0 ? undefined : { from, to }

/** What changed between the quote the user accepted and the one that replaced it (CHK-20). */
export function diffQuotes(previous: Quote, next: Quote): QuoteDiff {
  const lines = new Map<string, LineChange>()
  for (const line of next.lines) {
    const before = previous.lines.find((candidate) => candidate.itemId === line.itemId)
    if (!before) {
      lines.set(line.itemId, { added: true })
      continue
    }
    const change: LineChange = {}
    const unitPrice = differs(before.unitPrice, line.unitPrice)
    const lineTotal = differs(before.lineTotal, line.lineTotal)
    if (unitPrice) change.unitPrice = unitPrice
    if (lineTotal) change.lineTotal = lineTotal
    if (before.quantity !== line.quantity) {
      change.quantity = { from: before.quantity, to: line.quantity }
    }
    if (Object.keys(change).length > 0) lines.set(line.itemId, change)
  }
  const removed = previous.lines.filter(
    (line) => !next.lines.some((candidate) => candidate.itemId === line.itemId),
  )

  const totals: Partial<Record<TotalKey, AmountChange>> = {}
  for (const key of ['subtotal', 'discount', 'networkFee', 'total'] as const) {
    const change = differs(previous[key], next[key])
    if (change) totals[key] = change
  }
  const before = previous.coupon?.code ?? null
  const after = next.coupon?.code ?? null
  const coupon = before === after ? null : { from: before, to: after }

  return {
    lines,
    removed,
    totals,
    coupon,
    changed:
      lines.size > 0 || removed.length > 0 || Object.keys(totals).length > 0 || coupon !== null,
  }
}

export interface Shortage {
  nftId: string
  editionId: string
  name: string
  editionLabel: string
  /** Units the user can still take; `0` is sold out. */
  available: number | null
}

/** Names a shortage from the cart line it concerns, falling back to the ids (CHK-21). */
function shortage(
  items: readonly CartItem[],
  nftId: string,
  editionId: string,
  available: number | null,
): Shortage {
  const item = items.find((line) => line.nftId === nftId && line.editionId === editionId)
  return {
    nftId,
    editionId,
    name: item?.name ?? nftId,
    editionLabel: item?.editionLabel ?? editionId,
    available,
  }
}

/** The lines a quote refuses to sell, from its blocking issues. */
export function quoteShortages(quote: Quote, items: readonly CartItem[]): Shortage[] {
  return quote.issues.flatMap((issue) => {
    if (!issue.blocking || !issue.itemId) return []
    const item = items.find((line) => line.id === issue.itemId)
    if (!item) return []
    return [
      shortage(
        items,
        item.nftId,
        item.editionId,
        issue.code === 'UNAVAILABLE' ? 0 : (item.available ?? null),
      ),
    ]
  })
}

/** The lines named by `INSUFFICIENT_AVAILABILITY` (CHK-21). */
export function detailShortages(
  lines: readonly { nftId: string; editionId: string; available: number }[],
  items: readonly CartItem[],
): Shortage[] {
  return lines.map((line) => shortage(items, line.nftId, line.editionId, line.available))
}

/** "Emerald Ape #042, edição 1/10: esgotado" or "…: restam 2". */
export function shortageText(line: Shortage): string {
  const what = `${line.name}, edição ${line.editionLabel}`
  if (line.available === null) return `${what}: indisponível`
  return line.available === 0 ? `${what}: esgotado` : `${what}: restam ${String(line.available)}`
}

/** Non-blocking issues as notes for the review (CHK-22): payment stays possible. */
export function quoteNotes(quote: Quote, items: readonly CartItem[]): string[] {
  const notes: string[] = []
  for (const issue of quote.issues) {
    if (issue.blocking) continue
    if (issue.code === 'PRICE_CHANGED') {
      const item = items.find((line) => line.id === issue.itemId)
      notes.push(
        item
          ? `O preço de ${item.name} mudou desde que você o adicionou ao carrinho.`
          : 'O preço de um item mudou desde que você o adicionou ao carrinho.',
      )
    } else if (issue.code === 'COUPON_EXPIRED') {
      notes.push('Cupom expirado: o desconto não foi aplicado.')
    } else if (issue.code === 'COUPON_NOT_APPLICABLE') {
      notes.push('Cupom não aplicável ao subtotal atual: o desconto não foi aplicado.')
    }
  }
  return notes
}
