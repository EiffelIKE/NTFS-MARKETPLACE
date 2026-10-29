import { describe, expect, it } from 'vitest'

import type { QuoteIssue } from '@/contracts'

import { blockingMessage, couponIssueText } from './summary-messages'

const issue = (code: QuoteIssue['code'], blocking: boolean): QuoteIssue => ({ code, blocking })

describe('blockingMessage (CART-18)', () => {
  it('has nothing to say when no issue blocks, even with a price change', () => {
    expect(blockingMessage({ issues: [] })).toBeNull()
    expect(blockingMessage({ issues: [issue('PRICE_CHANGED', false)] })).toBeNull()
  })

  it('names what to fix, one sentence per kind', () => {
    expect(blockingMessage({ issues: [issue('UNAVAILABLE', true)] })).toBe(
      'Remova os itens esgotados para continuar.',
    )
    expect(blockingMessage({ issues: [issue('INSUFFICIENT_AVAILABILITY', true)] })).toBe(
      'Ajuste as quantidades indisponíveis para continuar.',
    )
    expect(
      blockingMessage({
        issues: [issue('INSUFFICIENT_AVAILABILITY', true), issue('UNAVAILABLE', true)],
      }),
    ).toBe(
      'Remova os itens esgotados para continuar. Ajuste as quantidades indisponíveis para continuar.',
    )
  })
})

describe('couponIssueText (CART-14)', () => {
  it('explains an expired or not applicable coupon, and says nothing otherwise', () => {
    expect(couponIssueText([issue('COUPON_EXPIRED', false)])).toBe(
      'Cupom expirado: desconto não aplicado.',
    )
    expect(couponIssueText([issue('COUPON_NOT_APPLICABLE', false)])).toBe(
      'Cupom não aplicável ao subtotal atual.',
    )
    expect(couponIssueText([issue('PRICE_CHANGED', false)])).toBeNull()
  })
})
