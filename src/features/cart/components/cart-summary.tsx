import { Link } from '@tanstack/react-router'
import type { UseQueryResult } from '@tanstack/react-query'

import { AlertCircleIcon } from '@/components/icons'
import { Alert, AlertAction, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { Cart, Quote } from '@/contracts'
import { formatEth } from '@/lib/money'
import { cn } from '@/lib/utils'

import { blockingMessage } from '../model/summary-messages'
import { CouponForm } from './coupon-form'

interface RowProps {
  label: React.ReactNode
  /** `undefined` while the amount is not known: a skeleton of the same box takes its place. */
  value: string | undefined
  prefix?: string
  caption?: string
  strong?: boolean
  outdated?: boolean
  testId: string
  className?: string
}

/** A summary row. The value slot has one fixed width, so a skeleton and a number share a box. */
function Row({ label, value, prefix, caption, strong, outdated, testId, className }: RowProps) {
  return (
    <div className={cn('flex items-start justify-between gap-3', className)}>
      <dt className={cn('text-body', strong ? 'font-bold text-foreground' : 'text-foreground')}>
        {label}
      </dt>
      <dd className="flex w-32 shrink-0 flex-col items-end">
        <span
          data-testid={testId}
          data-outdated={outdated ? true : undefined}
          className={cn(
            'flex min-h-6 items-center justify-end text-right text-title tabular-nums transition-opacity',
            strong ? 'font-bold text-text-accent' : 'font-normal text-foreground',
            outdated && 'opacity-60',
          )}
        >
          {value === undefined ? (
            <Skeleton className="h-5 w-24" />
          ) : (
            <>
              {prefix && <span className="mr-1 text-body">{prefix}</span>}
              {value}
            </>
          )}
        </span>
        {caption && <span className="text-caption-sm text-text-accent">{caption}</span>}
      </dd>
    </div>
  )
}

export interface CartSummaryProps {
  cart: Cart | undefined
  quote: UseQueryResult<Quote>
  /** `panel`: the desktop column. `sheet`: the fixed mobile sheet. */
  variant: 'panel' | 'sheet'
  signedIn: boolean
}

/**
 * Coupon, amounts and the way on (CART-12 – CART-18). Every amount comes from the quote (the
 * client computes nothing, CART-15); while it loads the slots are skeletons of the final size, and
 * while the amounts belong to an earlier cart version they are dimmed and the button stays off.
 */
export function CartSummary({ cart, quote, variant, signedIn }: CartSummaryProps) {
  const sheet = variant === 'sheet'
  const data = quote.data
  const loading = cart === undefined || quote.isPending
  // Amounts of an earlier cart version, or a refetch in flight (a live change): shown, dimmed.
  const outdated = !loading && (quote.isPlaceholderData || quote.isFetching)
  const failed = quote.isError && data === undefined
  const amounts = (pick: (q: Quote) => string) => (data ? formatEth(pick(data)) : undefined)
  const reason = data ? blockingMessage(data) : null
  const reasonId = 'cart-cta-reason'
  const canCheckout = data?.purchasable === true && !outdated && !failed

  return (
    <section
      aria-labelledby="cart-summary-title"
      data-testid="cart-summary"
      className={cn('flex flex-col gap-4', sheet && 'gap-3')}
    >
      <h2
        id="cart-summary-title"
        className={cn(
          'border-b border-border pb-3 text-title font-bold text-foreground',
          sheet && 'sr-only',
        )}
      >
        Resumo da carteira
      </h2>

      <CouponForm
        coupon={cart?.coupon ?? null}
        issues={data?.issues ?? []}
        variant={variant}
        disabled={cart === undefined}
      />

      {failed ? (
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
      ) : (
        <dl className="flex flex-col gap-3" aria-busy={loading || outdated}>
          <Row
            testId="summary-subtotal"
            label="Subtotal"
            value={loading ? undefined : amounts((q) => q.subtotal)}
            outdated={outdated}
          />
          <Row
            testId="summary-discount"
            label={
              <>
                Desconto do lançamento
                {data?.coupon && (
                  <span className="block text-caption-sm font-normal text-text-secondary">
                    Cupom {data.coupon.code}
                  </span>
                )}
              </>
            }
            prefix="(-)"
            value={loading ? undefined : amounts((q) => q.discount)}
            outdated={outdated}
          />
          <Row
            testId="summary-fee"
            label="Taxa de rede"
            caption="Taxa estimada"
            value={loading ? undefined : amounts((q) => q.networkFee)}
            outdated={outdated}
          />
          <Row
            testId="summary-total"
            className="border-t border-border pt-3"
            label="Total"
            strong
            value={loading ? undefined : amounts((q) => q.total)}
            outdated={outdated}
          />
        </dl>
      )}

      {reason && (
        <p id={reasonId} className="text-caption-sm text-error">
          {reason}
        </p>
      )}

      {canCheckout ? (
        <Button
          asChild
          className={cn('h-11', sheet && 'h-15 rounded-full bg-primary-soft text-body-lg')}
        >
          {signedIn ? (
            <Link to="/checkout">Conectar e finalizar</Link>
          ) : (
            <Link to="/login" search={{ redirect: '/checkout' }}>
              Conectar e finalizar
            </Link>
          )}
        </Button>
      ) : (
        <Button
          type="button"
          disabled
          aria-describedby={reason ? reasonId : undefined}
          className={cn('h-11', sheet && 'h-15 rounded-full text-body-lg disabled:bg-none')}
        >
          Conectar e finalizar
        </Button>
      )}

      {!sheet && (
        <Link
          to="/"
          hash="mercado"
          className="text-center text-body-lg text-text-accent hover:underline"
        >
          Continuar explorando
        </Link>
      )}
    </section>
  )
}
