import { getRouteApi } from '@tanstack/react-router'
import * as React from 'react'

import { announce } from '@/components/feedback'
import type { EditionId, NftDetail } from '@/contracts'
import { useCart } from '@/features/cart/model/use-cart'
import { formatEth } from '@/lib/money'

import {
  addableMax,
  clampQuantity,
  defaultEditionId,
  diffNft,
  inCartQuantity,
} from '../model/purchase'

const route = getRouteApi('/nfts/$nftId')

/**
 * Edition and quantity on the details screen (spec 06 design §5).
 *
 * - The edition starts from `?edition=` (DET-11), then is the user's choice. Choosing writes it to
 *   the URL with `replace`, so a shared link keeps it without filling the history.
 * - The quantity is the user's wish, shown clamped to what can be added (DET-14), so a limit that
 *   drops (a refetch, a live `nft.updated`, the cart growing) lowers it without losing the wish.
 * - When a newer NFT arrives, the change is announced (DET-24). The NFT comes from the query
 *   cache, which spec 03's default applier patches on `nft.updated`; this hook has no socket code.
 */
export function usePurchaseSelection(nft: NftDetail) {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const { data: cart } = useCart()

  const [chosen, setChosen] = React.useState<EditionId | null>(() =>
    defaultEditionId(nft.editions, search.edition),
  )
  // `null` when everything sold out, and then again once something is restocked.
  const selectedId = chosen ?? defaultEditionId(nft.editions)
  const edition = nft.editions.find((candidate) => candidate.id === selectedId) ?? null
  const inCart = edition ? inCartQuantity(cart, nft.id, edition.id) : 0
  const max = edition ? addableMax(edition, inCart) : 0

  const [wanted, setWanted] = React.useState(1)
  const quantity = clampQuantity(wanted, max)

  const selectEdition = (id: EditionId) => {
    setChosen(id)
    const next = nft.editions.find((candidate) => candidate.id === id)
    if (next) {
      setWanted((q) => clampQuantity(q, addableMax(next, inCartQuantity(cart, nft.id, id))))
    }
    void navigate({
      search: (prev) => ({ ...prev, edition: id }),
      replace: true,
      resetScroll: false,
    })
  }

  const changeQuantity = (next: number) => {
    setWanted(clampQuantity(next, max))
  }

  /** After a "not enough left" answer: the wish cannot exceed what the server just said. */
  const limitTo = (remaining: number) => {
    setWanted((q) => clampQuantity(q, remaining))
  }

  const previous = React.useRef({ nft, quantity })
  React.useEffect(() => {
    const before = previous.current
    previous.current = { nft, quantity }
    if (before.nft.version === nft.version) return

    const diff = diffNft(before.nft, nft, selectedId)
    const polite: string[] = []
    if (diff.priceChanged) polite.push(`Preço atualizado para ${formatEth(diff.priceChanged)}`)
    if (diff.selectedSoldOut && edition) {
      announce(`A edição ${edition.label} esgotou.`, 'assertive')
    } else if (quantity < before.quantity) {
      polite.push(`Quantidade ajustada para ${String(quantity)} (disponível: ${String(max)})`)
    }
    if (polite.length > 0) announce(`${polite.join('. ')}.`)
  }, [nft, quantity, selectedId, edition, max])

  return {
    selectedId,
    edition,
    inCart,
    max,
    quantity,
    selectEdition,
    changeQuantity,
    limitTo,
  }
}

export type PurchaseSelection = ReturnType<typeof usePurchaseSelection>
