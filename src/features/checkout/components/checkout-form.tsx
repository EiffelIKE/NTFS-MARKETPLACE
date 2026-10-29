import { useQuery } from '@tanstack/react-query'
import * as React from 'react'

import { applyServerErrors, setFormError } from '@/components/form/server-errors'
import { submitForm } from '@/components/form/submit'
import { useFormFocus } from '@/components/form/use-form-focus'
import { ChevronDownIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import type { Cart, Profile, Wallet } from '@/contracts'
import { quoteQueryOptions } from '@/features/cart/api/cart-queries'
import { useCartLive } from '@/features/cart/model/use-cart-live'
import { useCartOwner } from '@/features/cart/model/use-cart'
import { useBottomBarInset } from '@/hooks/use-bottom-bar-inset'
import { useMediaQuery } from '@/hooks/use-media-query'
import type { ApiError } from '@/lib/http/errors'
import { cn } from '@/lib/utils'

import { networksQueryOptions } from '../api/checkout-queries'
import { draftStore } from '../model/draft-store'
import {
  CheckoutFormSchema,
  defaultWallet,
  mapServerFields,
  prefill,
  type CheckoutValues,
} from '../model/form'
import { useCheckoutForm } from '../model/use-checkout-form'
import { CheckoutContext, useCheckoutContext, type CheckoutContextValue } from './checkout-context'
import { CheckoutSummary, TotalLine } from './checkout-summary'
import { useQuoteState } from './use-quote-state'
import { CollectorFields, NoteField } from './collector-fields'
import { ProviderPicker } from './provider-picker'
import { ReviewDialog } from './review-dialog'
import { WalletCards, WalletToggle } from './wallet-picker'

const FORM_ID = 'checkout-form'
// `walletId` has no input of its own: a refusal about it goes to the form-level alert.
const FORM_FIELDS = Object.keys(CheckoutFormSchema.shape).filter((name) => name !== 'walletId')

/** What the form starts with: the draft when it still fits the wallets, else the prefill. */
function startingValues(userId: string, profile: Profile, wallets: readonly Wallet[]) {
  const draft = draftStore.read(userId)
  const drafted = draft && wallets.find((wallet) => wallet.id === draft.values.walletId)
  const wallet = drafted ?? defaultWallet(wallets)
  if (!wallet) throw new Error('Checkout needs a wallet')
  const suggested = prefill(profile, wallet)
  // The address always comes from the wallet as it is now (CHK-10).
  const initial: CheckoutValues = drafted
    ? { ...draft.values, walletAddress: drafted.address }
    : suggested
  return { initial, suggested }
}

interface CheckoutFormProps {
  userId: string
  cart: Cart
  profile: Profile
  wallets: readonly Wallet[]
  /** An order exists: leave the form for the order's panel (CHK-29). */
  onOrder: (orderId: string) => void
  /** Open the review at once: a refused payment reopens as the user left it (CHK-32). */
  reviewOnMount?: boolean
}

/**
 * The checkout form and its compositions (spec 09 design §8, §9): the desktop two columns from
 * `lg`, the mobile wallet-first screen below it. One form instance serves both, and one composition
 * is mounted at a time, so every control exists once. Pressing "Confirmar compra" validates, then
 * opens the review (CHK-07, CHK-18).
 */
export function CheckoutForm({
  userId,
  cart,
  profile,
  wallets,
  onOrder,
  reviewOnMount,
}: CheckoutFormProps) {
  const wide = useMediaQuery('(min-width: 1024px)')
  const owner = useCartOwner()
  const { formRef, focusFirstInvalid } = useFormFocus()
  const [reviewOpen, setReviewOpen] = React.useState(reviewOnMount === true)
  const [detailsOpen, setDetailsOpen] = React.useState(false)
  const [start] = React.useState(() => startingValues(userId, profile, wallets))

  const { form, values, switchWallet, discardDraft } = useCheckoutForm({
    userId,
    initial: start.initial,
    suggested: start.suggested,
    onValid: () => {
      setReviewOpen(true)
    },
    onInvalid: () => {
      // Mobile keeps the fields in a collapsed section: open it so focus has somewhere to go.
      setDetailsOpen(true)
      focusFirstInvalid()
    },
  })

  const wallet = wallets.find((candidate) => candidate.id === values.walletId) ?? wallets[0]
  const networks = useQuery(networksQueryOptions())
  const quote = useQuery({
    ...quoteQueryOptions(owner, cart.version, values.network),
    staleTime: 0,
    enabled: cart.items.length > 0,
  })
  // A price or availability change reaches the cart and, through its key, this quote (CHK-19).
  useCartLive(cart)

  if (!wallet) return null

  const context: CheckoutContextValue = {
    form,
    values,
    cart,
    wallets,
    wallet,
    networks,
    quote,
    signedIn: true,
    switchWallet,
  }

  const refused = (error: ApiError) => {
    setReviewOpen(false)
    const { error: mapped, unmapped } = mapServerFields(error, FORM_FIELDS)
    const placed = applyServerErrors(form, mapped)
    if (unmapped.length > 0) setFormError(form, unmapped.join(' '))
    else if (!placed) setFormError(form, error.message)
    setDetailsOpen(true)
    focusFirstInvalid()
  }

  const created = (orderId: string) => {
    discardDraft()
    setReviewOpen(false)
    onOrder(orderId)
  }

  return (
    <CheckoutContext value={context}>
      {wide ? (
        <DesktopComposition formRef={formRef} />
      ) : (
        <MobileComposition
          formRef={formRef}
          detailsOpen={detailsOpen}
          onDetailsOpenChange={setDetailsOpen}
        />
      )}
      <ReviewDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        onOrder={created}
        onInvalid={refused}
      />
    </CheckoutContext>
  )
}

interface FormShellProps {
  formRef: React.RefObject<HTMLFormElement | null>
  className?: string
  children: React.ReactNode
}

/**
 * The native `<form>`. Its submit button lives elsewhere on the page (`form={FORM_ID}`), so the
 * coupon's own form stays out of it: forms cannot nest.
 */
function FormShell({ formRef, className, children }: FormShellProps) {
  const { form } = useCheckoutContext()
  return (
    <form
      id={FORM_ID}
      ref={formRef}
      noValidate
      aria-label="Perfil do colecionador"
      className={className}
      onSubmit={(event) => {
        event.preventDefault()
        event.stopPropagation()
        void submitForm(form)
      }}
    >
      <form.AppForm>
        <form.FormAlert />
      </form.AppForm>
      {children}
    </form>
  )
}

function ConfirmButton({ className }: { className?: string }) {
  const { quote } = useCheckoutContext()
  const { failed } = useQuoteState()
  return (
    <Button
      type="submit"
      form={FORM_ID}
      disabled={failed && quote.data === undefined}
      className={className}
    >
      Confirmar compra
    </Button>
  )
}

function DesktopComposition({ formRef }: { formRef: React.RefObject<HTMLFormElement | null> }) {
  return (
    <div className="grid items-start gap-x-8 lg:grid-cols-[minmax(0,1fr)_25.3125rem]">
      <section aria-labelledby="collector-title" className="flex flex-col gap-4">
        <h2 id="collector-title" className="text-title text-foreground">
          Perfil do colecionador
        </h2>
        <FormShell formRef={formRef} className="flex flex-col gap-6">
          <CollectorFields />
          <WalletToggle />
          <NoteField className="max-w-87.5" />
        </FormShell>
      </section>

      <div className="flex flex-col gap-6">
        <CheckoutSummary />
        <section aria-labelledby="provider-title" className="flex flex-col gap-4">
          <h2 id="provider-title" className="text-center text-title text-foreground">
            Carteira e rede
          </h2>
          <p
            data-testid="compatible-wallets"
            className="tracking-wide w-fit self-start rounded-sm border border-border bg-ink px-3 py-1 text-tiny font-medium text-text-accent uppercase"
          >
            MetaMask • WalletConnect • Coinbase
          </p>
          <ProviderPicker variant="list" />
        </section>
        <ConfirmButton className="h-11 w-full" />
      </div>
    </div>
  )
}

function MobileComposition({
  formRef,
  detailsOpen,
  onDetailsOpenChange,
}: {
  formRef: React.RefObject<HTMLFormElement | null>
  detailsOpen: boolean
  onDetailsOpenChange: (open: boolean) => void
}) {
  const bar = React.useRef<HTMLDivElement>(null)

  // The action bar is fixed, so the page keeps its height as bottom padding (as the cart does).
  useBottomBarInset(bar)

  return (
    <div className="flex flex-col gap-6 pt-2 pb-[calc(var(--bottom-bar-inset,6rem)+1rem)] [@media(max-height:560px)]:pb-6">
      <WalletCards />

      <section aria-labelledby="provider-title" className="flex flex-col gap-4">
        <h2 id="provider-title" className="text-title text-foreground">
          Carteira e rede
        </h2>
        <ProviderPicker variant="rows" />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-title text-foreground">
          <button
            type="button"
            aria-expanded={detailsOpen}
            aria-controls="collector-details"
            onClick={() => {
              onDetailsOpenChange(!detailsOpen)
            }}
            className="flex w-full cursor-pointer items-center justify-between gap-3 text-left"
          >
            Dados do colecionador
            <ChevronDownIcon
              className={cn('size-5 transition-transform', detailsOpen && 'rotate-180')}
            />
          </button>
        </h2>
        <div id="collector-details" hidden={!detailsOpen}>
          <FormShell formRef={formRef} className="flex flex-col gap-5">
            <CollectorFields />
            <NoteField />
          </FormShell>
        </div>
      </section>

      <TotalLine />

      <div
        ref={bar}
        className="fixed inset-x-0 bottom-0 z-30 bg-background px-6 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] [@media(max-height:560px)]:static [@media(max-height:560px)]:p-0"
      >
        <ConfirmButton className="h-15 w-full rounded-full bg-primary-soft text-body-lg" />
      </div>
    </div>
  )
}
