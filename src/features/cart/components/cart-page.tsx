import * as React from 'react'

import { AlertCircleIcon } from '@/components/icons'
import { PageBreadcrumb } from '@/components/layout/page-breadcrumb'
import { LoadingRegion } from '@/components/loading-region'
import { Alert, AlertAction, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import type { Cart } from '@/contracts'
import { useSession } from '@/features/auth/model/use-session'
import { RelatedRow } from '@/features/nft-details/components/related-row'
import { useBottomBarInset } from '@/hooks/use-bottom-bar-inset'
import { useMediaQuery } from '@/hooks/use-media-query'

import { CART_HEADING_ID, removeButtonId, useCartActions } from '../model/use-cart-actions'
import { useCartLive } from '../model/use-cart-live'
import { useCart, useQuote } from '../model/use-cart'
import { CartLineCards } from './cart-line-card'
import { CartEmpty } from './cart-empty'
import { CartCardsSkeleton, CartTableSkeleton } from './cart-skeleton'
import { CartSummary } from './cart-summary'
import { CartTable } from './cart-table'

/**
 * The cart screen (spec 07 design §8). One composition is mounted at a time (desktop table and
 * right column from `lg`, cards and a fixed bottom sheet below), so every control exists once.
 * Lines come from the cart, amounts from the quote; live changes refresh both (CART-19).
 */
export function CartPage() {
  const wide = useMediaQuery('(min-width: 1024px)')
  const cart = useCart()
  const signedIn = useSession().status === 'authenticated'
  const quote = useQuote(cart.data)
  useCartLive(cart.data)
  const onRemoved = useFocusAfterRemoval(cart.data)

  const loading = cart.isPending
  const empty = cart.data?.items.length === 0

  return (
    <LoadingRegion
      loading={loading}
      label="Carregando carrinho"
      className="mx-auto w-full max-w-150 px-6 lg:max-w-page"
    >
      <h1 id={CART_HEADING_ID} tabIndex={-1} className="sr-only outline-none">
        Carrinho de NFTs
      </h1>

      {wide && <PageBreadcrumb current="Carrinho" />}

      {cart.isError && cart.data === undefined ? (
        <Alert className="mt-6">
          <AlertCircleIcon />
          <AlertDescription>
            Não foi possível carregar o carrinho. {cart.error.message}
          </AlertDescription>
          <AlertAction>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void cart.refetch()
              }}
            >
              Tentar novamente
            </Button>
          </AlertAction>
        </Alert>
      ) : empty ? (
        <CartEmpty />
      ) : wide ? (
        <DesktopCart cart={cart.data} quote={quote} signedIn={signedIn} onRemoved={onRemoved} />
      ) : (
        <MobileCart cart={cart.data} quote={quote} signedIn={signedIn} onRemoved={onRemoved} />
      )}
    </LoadingRegion>
  )
}

interface CompositionProps {
  cart: Cart | undefined
  quote: ReturnType<typeof useQuote>
  signedIn: boolean
  onRemoved: (removedId: string, nextId: string | null) => void
}

/**
 * After a removal, focus goes to the next line's remove button, or to the heading when no line
 * remains (CART-10). The target is recorded before the request and applied once the line is gone
 * from the cart the page renders.
 */
function useFocusAfterRemoval(cart: Cart | undefined) {
  const pending = React.useRef<{ removedId: string; nextId: string | null } | null>(null)
  React.useEffect(() => {
    const target = pending.current
    if (!target || !cart || cart.items.some((item) => item.id === target.removedId)) return
    pending.current = null
    const element = target.nextId
      ? document.getElementById(removeButtonId(target.nextId))
      : document.getElementById(CART_HEADING_ID)
    element?.focus()
  }, [cart])
  return (removedId: string, nextId: string | null) => {
    pending.current = { removedId, nextId }
    // The line may already be gone from the page (the cache changed before this call).
    if (cart && !cart.items.some((item) => item.id === removedId)) {
      pending.current = null
      const element = nextId
        ? document.getElementById(removeButtonId(nextId))
        : document.getElementById(CART_HEADING_ID)
      element?.focus()
    }
  }
}

function DesktopCart({ cart, quote, signedIn, onRemoved }: CompositionProps) {
  return (
    <>
      <div className="grid gap-x-8 lg:grid-cols-[minmax(0,1fr)_20.625rem] xl:gap-x-22.5">
        <div>
          {cart ? (
            <CartLines cart={cart} onRemoved={onRemoved} layout="table" />
          ) : (
            <CartTableSkeleton />
          )}
        </div>
        <CartSummary cart={cart} quote={quote} variant="panel" signedIn={signedIn} />
      </div>
      {cart?.items[0] && (
        <RelatedRow
          nftId={cart.items[0].nftId}
          title="Colecionadores também viram"
          hideOnError
          className="mt-24"
        />
      )}
    </>
  )
}

function CartLines({
  cart,
  onRemoved,
  layout,
}: {
  cart: Cart
  onRemoved: (removedId: string, nextId: string | null) => void
  layout: 'table' | 'cards'
}) {
  const actions = useCartActions(cart, onRemoved)
  return layout === 'table' ? (
    <CartTable cart={cart} actions={actions} />
  ) : (
    <CartLineCards cart={cart} actions={actions} />
  )
}

function MobileCart({ cart, quote, signedIn, onRemoved }: CompositionProps) {
  const sheet = React.useRef<HTMLDivElement>(null)

  // The sheet is fixed, so the page keeps its own height as bottom padding: the last line stays
  // reachable above it (CART-24). In short viewports the sheet is static and the padding is 0.
  useBottomBarInset(sheet)

  return (
    <div className="flex flex-col gap-6 pt-2 pb-[calc(var(--bottom-bar-inset,20rem)+1rem)] [@media(max-height:560px)]:pb-6">
      {cart ? (
        <CartLines cart={cart} onRemoved={onRemoved} layout="cards" />
      ) : (
        <CartCardsSkeleton />
      )}
      <div
        ref={sheet}
        className="fixed inset-x-0 bottom-0 z-30 rounded-t-[30px] bg-surface-card pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_var(--color-ink)] [@media(max-height:560px)]:static [@media(max-height:560px)]:shadow-none"
      >
        <div className="mx-auto max-w-150 px-6 pt-5">
          <CartSummary cart={cart} quote={quote} variant="sheet" signedIn={signedIn} />
        </div>
      </div>
    </div>
  )
}
