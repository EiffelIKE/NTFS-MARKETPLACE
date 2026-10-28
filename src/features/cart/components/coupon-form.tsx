import * as React from 'react'

import { announce, notify } from '@/components/feedback'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupButton, InputGroupInput } from '@/components/ui/input-group'
import type { Coupon, QuoteIssue } from '@/contracts'
import { isSessionError } from '@/lib/http/auth'
import { isApiError } from '@/lib/http/errors'
import { cn } from '@/lib/utils'

import { useApplyCoupon, useRemoveCoupon } from '../api/cart-mutations'
import { couponIssueText, EMPTY_CODE_MESSAGE } from '../model/summary-messages'

const COUPON_CODES = ['COUPON_INVALID', 'COUPON_EXPIRED', 'COUPON_NOT_APPLICABLE'] as const

/**
 * Coupon field and applied-coupon row (CART-12 – CART-14). A refused code keeps what the user
 * typed and shows the API's message on the field; the cart is untouched. An applied coupon
 * replaces the form with its code, description and "Remover".
 */
export function CouponForm({
  coupon,
  issues,
  variant,
  disabled = false,
}: {
  coupon: Coupon | null
  issues: readonly QuoteIssue[]
  variant: 'panel' | 'sheet'
  disabled?: boolean
}) {
  const apply = useApplyCoupon()
  const remove = useRemoveCoupon()
  const [code, setCode] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const sending = React.useRef(false)
  const sheet = variant === 'sheet'

  const submit = async (event: React.SyntheticEvent) => {
    event.preventDefault()
    if (sending.current || disabled) return
    const value = code.trim().toUpperCase()
    if (value === '') {
      setError(EMPTY_CODE_MESSAGE)
      return
    }
    sending.current = true
    setError(null)
    try {
      await apply.mutateAsync(value)
      setCode('')
      announce(`Cupom ${value} aplicado`)
    } catch (failure) {
      if (isSessionError(failure)) return
      if (COUPON_CODES.some((candidate) => isApiError(failure, candidate))) {
        const message = isApiError(failure) ? (failure.fields?.code?.[0] ?? failure.message) : ''
        setError(message)
      } else {
        notify.error(isApiError(failure) ? failure.message : 'Não foi possível aplicar o cupom.')
      }
    } finally {
      sending.current = false
    }
  }

  if (coupon) {
    const notice = couponIssueText(issues)
    return (
      <div data-testid="applied-coupon" className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <p className="text-body text-foreground">
            <span className="sr-only">Cupom aplicado: </span>
            <strong className="font-bold">{coupon.code}</strong>
            <span className="text-text-secondary"> — {coupon.description}</span>
          </p>
          <Button
            type="button"
            variant="link"
            aria-label={`Remover cupom ${coupon.code}`}
            loading={remove.isPending}
            disabled={disabled}
            onClick={() => {
              remove.mutate(undefined, {
                onSuccess: () => {
                  announce(`Cupom ${coupon.code} removido`)
                },
                onError: (failure) => {
                  const { message } = failure
                  if (!isSessionError(failure)) notify.error(message)
                },
              })
            }}
            className="text-body"
          >
            Remover
          </Button>
        </div>
        {notice && <p className="text-caption-sm text-error">{notice}</p>}
      </div>
    )
  }

  return (
    <form noValidate onSubmit={(event) => void submit(event)}>
      <Field invalid={error !== null}>
        <FieldLabel className={cn('text-caption font-bold text-foreground', sheet && 'sr-only')}>
          Código promocional
        </FieldLabel>
        <InputGroup
          className={cn(
            sheet && 'h-12.5 rounded-full border-border-soft bg-surface-dark pr-0 pl-1',
            !sheet && 'h-11.25',
          )}
        >
          <InputGroupInput
            value={code}
            maxLength={32}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="Digite o código promocional..."
            disabled={disabled}
            onChange={(event) => {
              setCode(event.target.value)
              if (error) setError(null)
            }}
            className={cn('text-caption-sm', sheet && 'px-4')}
          />
          <InputGroupButton
            type="submit"
            variant="primary"
            size="default"
            loading={apply.isPending}
            disabled={disabled}
            className={cn(
              'rounded-l-none px-4 text-body-lg font-bold',
              sheet && 'rounded-full bg-primary-soft px-7 disabled:bg-none',
            )}
          >
            Aplicar
          </InputGroupButton>
        </InputGroup>
        <FieldError role="alert">{error}</FieldError>
      </Field>
    </form>
  )
}
