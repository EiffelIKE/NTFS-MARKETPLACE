import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import * as React from 'react'

import { notify } from '@/components/feedback'
import { CartIcon, SpinnerIcon } from '@/components/icons'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { Cart, EditionId, NftSummary } from '@/contracts'
import { session } from '@/features/auth/model/instance'
import { catalogKeys } from '@/features/catalog/api/keys'
import { nftDetailQuery } from '@/features/catalog/api/queries'
import { actionClass } from '@/features/catalog/components/product-card'
import { CART_FULL_MESSAGE, describeAddError } from '@/features/nft-details/model/add-errors'
import { addableMax, defaultEditionId, inCartQuantity } from '@/features/nft-details/model/purchase'

import { cartKeys } from '../api/cart-keys'
import { useAddCartItem } from '../api/cart-mutations'
import { notifyAddError, notifyAdded } from '../model/add-feedback'

/**
 * The cart button of the desktop card (DET-25): adds one unit of the default edition and confirms
 * with the same toast as the details screen. It reads the details first (usually cached by the
 * hover preload) to pick the edition, and applies the details screen's limits and error handling.
 */
export function CardCartAction({ nft }: { nft: Pick<NftSummary, 'id' | 'name' | 'available'> }) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const add = useAddCartItem()
  const busy = React.useRef(false)
  const [pending, setPending] = React.useState(false)

  const run = async (): Promise<void> => {
    // A ref, not `add.isPending`: two clicks in one frame must send one request (DET-17).
    if (busy.current) return
    busy.current = true
    setPending(true)
    let target: { editionId: EditionId; inCart: number } | null = null
    try {
      const detail = await queryClient.query(nftDetailQuery(nft.id))
      const editionId = defaultEditionId(detail.editions)
      const edition = detail.editions.find((e) => e.id === editionId)
      if (!editionId || !edition) {
        notify.error('Este NFT está esgotado.')
        return
      }
      const cart = queryClient.getQueryData<Cart>(cartKeys.detail(session.owner()))
      const inCart = inCartQuantity(cart, nft.id, editionId)
      target = { editionId, inCart }
      if (addableMax(edition, inCart) < 1) {
        notify.error(CART_FULL_MESSAGE)
        return
      }
      await add.mutateAsync({ nftId: nft.id, editionId, quantity: 1 })
      notifyAdded(() => {
        void router.navigate({ to: '/cart' })
      })
    } catch (error) {
      const outcome = describeAddError(error, {
        nftId: nft.id,
        editionId: target?.editionId ?? 'open',
        inCart: target?.inCart ?? 0,
      })
      if (outcome.kind !== 'failed' && outcome.kind !== 'session') {
        void queryClient.invalidateQueries({ queryKey: catalogKeys.detail(nft.id) })
      }
      notifyAddError(outcome, () => {
        void run()
      })
    } finally {
      busy.current = false
      setPending(false)
    }
  }

  const button = (
    <button
      type="button"
      aria-label={`Adicionar ${nft.name} ao carrinho`}
      aria-disabled={!nft.available || pending || undefined}
      className={`${actionClass} aria-disabled:cursor-not-allowed aria-disabled:text-disabled`}
      onClick={() => {
        if (nft.available) void run()
      }}
    >
      {pending ? <SpinnerIcon /> : <CartIcon />}
    </button>
  )

  if (nft.available) return button
  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent>Esgotado</TooltipContent>
    </Tooltip>
  )
}
