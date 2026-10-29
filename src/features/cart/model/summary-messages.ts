import type { Quote, QuoteIssue } from '@/contracts'

/** One sentence per blocking issue kind, above the checkout button (CART-18). */
export function blockingMessage(quote: Pick<Quote, 'issues'>): string | null {
  const blocking = quote.issues.filter((issue) => issue.blocking)
  const sentences: string[] = []
  if (blocking.some((issue) => issue.code === 'UNAVAILABLE')) {
    sentences.push('Remova os itens esgotados para continuar.')
  }
  if (blocking.some((issue) => issue.code === 'INSUFFICIENT_AVAILABILITY')) {
    sentences.push('Ajuste as quantidades indisponíveis para continuar.')
  }
  return sentences.length > 0 ? sentences.join(' ') : null
}

/** The notice for an applied coupon that gives no discount (CART-14). */
export function couponIssueText(issues: readonly QuoteIssue[]): string | null {
  if (issues.some((issue) => issue.code === 'COUPON_EXPIRED')) {
    return 'Cupom expirado: desconto não aplicado.'
  }
  if (issues.some((issue) => issue.code === 'COUPON_NOT_APPLICABLE')) {
    return 'Cupom não aplicável ao subtotal atual.'
  }
  return null
}

export const EMPTY_CODE_MESSAGE = 'Informe um código.'
