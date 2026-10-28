import * as React from 'react'

import { AlertCircleIcon } from '@/components/icons'
import { Alert, AlertAction, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CouponForm } from '@/features/cart/components/coupon-form'
import { formatEth } from '@/lib/money'

import { useCheckoutContext } from './checkout-context'
import { useQuoteState } from './use-quote-state'
import { QuoteAmounts, QuoteLines } from './quote-summary'

/** The quote's failure, inline where its amounts would be, with a retry (CHK-04). */
export function QuoteError() {
  const { quote } = useCheckoutContext()
  return (
    <Alert>
      <AlertCircleIcon />
      <AlertDescription>Não foi possível calcular o total.</AlertDescription>
      <AlertAction>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            void quote.refetch()
          }}
        >
          Tentar novamente
        </Button>
      </AlertAction>
    </Alert>
  )
}

/**
 * Desktop "Seus NFTs" (Figma "Pagamento", CHK-12): the lines, the coupon behind "Tem um código
 * promocional? Aplique aqui" (spec 07's form, unchanged), and the quote's amounts for the chosen
 * network. The network fee and the total follow the "Rede" select with no client arithmetic.
 */
export function CheckoutSummary() {
  const { cart, quote } = useCheckoutContext()
  const { outdated, failed } = useQuoteState()
  const [couponOpen, setCouponOpen] = React.useState(false)
  const showCoupon = couponOpen || cart.coupon !== null

  return (
    <section
      aria-labelledby="summary-title"
      data-testid="checkout-summary"
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-2">
        <h2 id="summary-title" className="text-title text-foreground">
          Seus NFTs
        </h2>
        <div
          className="flex justify-between text-body-lg font-bold text-foreground"
          aria-hidden="true"
        >
          <span>NFTs</span>
          <span>Subtotal</span>
        </div>
      </div>

      <QuoteLines cart={cart} quote={quote.data} outdated={outdated} />

      {showCoupon ? (
        <CouponForm coupon={cart.coupon} issues={quote.data?.issues ?? []} variant="panel" />
      ) : (
        <button
          type="button"
          aria-expanded={false}
          onClick={() => {
            setCouponOpen(true)
          }}
          className="cursor-pointer self-center text-body text-foreground hover:text-text-accent hover:underline"
        >
          Tem um código promocional? Aplique aqui
        </button>
      )}

      {failed ? <QuoteError /> : <QuoteAmounts quote={quote.data} outdated={outdated} />}
    </section>
  )
}

/** Mobile "Total: 8.936 ETH" (Figma), from the quote like every amount. */
export function TotalLine() {
  const { quote } = useCheckoutContext()
  const { outdated, failed } = useQuoteState()
  if (failed) return <QuoteError />
  return (
    <div
      className="flex items-baseline justify-end gap-6 text-title text-foreground"
      aria-busy={quote.isPending || outdated}
    >
      <span>Total:</span>
      <span
        data-testid="quote-total"
        className="min-w-24 text-right font-bold text-text-accent tabular-nums"
      >
        {quote.data ? formatEth(quote.data.total) : <Skeleton className="ml-auto h-5 w-24" />}
      </span>
    </div>
  )
}
