import { useQueryClient } from '@tanstack/react-query'
import * as React from 'react'

import { PageBreadcrumb } from '@/components/layout/page-breadcrumb'
import { LoadingRegion } from '@/components/loading-region'
import type { Order } from '@/contracts'
import { useProfile, useWallets } from '@/features/account/model/use-account'
import { useAccountUserId } from '@/features/account/model/use-account'
import { cartKeys } from '@/features/cart/api/cart-keys'
import { useCart, useCartOwner } from '@/features/cart/model/use-cart'
import { useMediaQuery } from '@/hooks/use-media-query'

import { useTrackedOrder } from '../api/use-tracked-order'
import { draftStore } from '../model/draft-store'
import { valuesFromOrder } from '../model/form'
import { CheckoutForm } from './checkout-form'
import { CheckoutSkeleton } from './checkout-skeleton'
import {
  CheckoutChecking,
  CheckoutEmpty,
  CheckoutNoWallet,
  CheckoutUnknown,
  RegionError,
} from './checkout-states'
import { TrackedOrder } from './tracked-order'

/**
 * The checkout screen (spec 09 design §3). Gates, first match wins: an order to follow (pending,
 * or refused and not yet acknowledged), then the loading and error regions, an empty cart, no
 * wallet, and finally the form. The order comes first so a refresh or a reconnection while an
 * order is pending never offers the pay button again (CHK-30).
 */
export function CheckoutPage() {
  const wide = useMediaQuery('(min-width: 1024px)')
  const queryClient = useQueryClient()
  const owner = useCartOwner()
  const userId = useAccountUserId()
  const cart = useCart()
  const profile = useProfile()
  const wallets = useWallets()
  const { state, track, release } = useTrackedOrder({
    cartEmpty: cart.data?.items.length === 0,
  })
  const [fresh, setFresh] = React.useState(false)
  const [reviewOnMount, setReviewOnMount] = React.useState(false)

  const retryRefused = (order: Order) => {
    // The form reopens as the user filled it, with a fresh quote and a new attempt (CHK-32).
    if (userId) draftStore.write(userId, { values: valuesFromOrder(order) })
    release(order.id)
    setFresh(false)
    setReviewOnMount(true)
    void queryClient.invalidateQueries({ queryKey: cartKeys.detail(owner) })
  }

  const loading =
    state.phase === 'loading' || cart.isPending || profile.isPending || wallets.isPending
  const content = (() => {
    if (state.phase === 'checking') return <CheckoutChecking />
    if (state.phase === 'unknown')
      return <CheckoutUnknown error={state.error} onRetry={state.retry} />
    if (state.phase === 'order') {
      return (
        <TrackedOrder
          orderId={state.orderId}
          fresh={fresh}
          onRetry={retryRefused}
          onGone={() => {
            release(state.orderId)
          }}
          onLeave={() => {
            release(state.orderId)
          }}
        />
      )
    }
    if (loading) return <CheckoutSkeleton />
    if (cart.isError && cart.data === undefined) {
      return (
        <RegionError
          message={`Não foi possível carregar o carrinho. ${cart.error.message}`}
          onRetry={() => void cart.refetch()}
        />
      )
    }
    if (profile.isError && profile.data === undefined) {
      return (
        <RegionError
          message={`Não foi possível carregar seus dados. ${profile.error.message}`}
          onRetry={() => void profile.refetch()}
        />
      )
    }
    if (wallets.isError && wallets.data === undefined) {
      return (
        <RegionError
          message={`Não foi possível carregar suas carteiras. ${wallets.error.message}`}
          onRetry={() => void wallets.refetch()}
        />
      )
    }
    if (cart.data.items.length === 0) return <CheckoutEmpty />
    if (wallets.data.items.length === 0) return <CheckoutNoWallet />
    if (userId === undefined) return <CheckoutSkeleton />
    return (
      <CheckoutForm
        userId={userId}
        cart={cart.data}
        profile={profile.data}
        wallets={wallets.data.items}
        reviewOnMount={reviewOnMount}
        onOrder={(orderId) => {
          setFresh(true)
          setReviewOnMount(false)
          track(orderId)
        }}
      />
    )
  })()

  return (
    <LoadingRegion
      loading={loading}
      label="Carregando pagamento"
      className="mx-auto w-full max-w-150 px-6 lg:max-w-page"
    >
      <h1 className="sr-only">Finalizar compra</h1>
      {wide && <PageBreadcrumb current="Pagamento" />}
      {content}
    </LoadingRegion>
  )
}
