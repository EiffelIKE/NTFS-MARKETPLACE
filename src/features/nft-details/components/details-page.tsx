import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { getRouteApi, Link, useRouter } from '@tanstack/react-router'
import * as React from 'react'

import { notify } from '@/components/feedback'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import type { NftDetail } from '@/contracts'
import { useAddCartItem } from '@/features/cart/api/cart-mutations'
import { notifyAddError, notifyAdded } from '@/features/cart/model/add-feedback'
import { catalogKeys } from '@/features/catalog/api/keys'
import { nftDetailQuery } from '@/features/catalog/api/queries'
import { useMediaQuery } from '@/hooks/use-media-query'

import { usePurchaseSelection } from '../hooks/use-purchase-selection'
import { CART_FULL_MESSAGE, SOLD_OUT_MESSAGE, describeAddError } from '../model/add-errors'
import { editionCaption, isSoldOut } from '../model/purchase'
import { DetailsTabs, type DetailsTab } from './details-tabs'
import { EditionPicker } from './edition-picker'
import { Gallery } from './gallery'
import { MetaList } from './meta-list'
import { MobileBuyBar } from './mobile-buy-bar'
import { PriceRating, RatingChip } from './price-rating'
import { PurchaseActions } from './purchase-actions'
import { RelatedRow } from './related-row'
import { ShareRow } from './share-row'

const route = getRouteApi('/nfts/$nftId')

/**
 * The details screen (spec 06 design §6). It reads the NFT from the query cache, so a refetch or a
 * live `nft.updated` re-renders price, editions and limits on its own (DET-24).
 */
export function DetailsPage() {
  const { nftId } = route.useParams()
  const { data: nft } = useSuspenseQuery(nftDetailQuery(nftId))
  // Keyed by id: going to a related NFT starts from a clean selection.
  return <DetailsContent key={nft.id} nft={nft} />
}

function DetailsContent({ nft }: { nft: NftDetail }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const wide = useMediaQuery('(min-width: 1024px)')
  const selection = usePurchaseSelection(nft)
  const add = useAddCartItem()
  const { edition } = selection

  const [tab, setTab] = React.useState<DetailsTab>('details')
  const tabsRef = React.useRef<HTMLDivElement>(null)
  const [addMessage, setAddMessage] = React.useState<string | null>(null)
  const sending = React.useRef(false)

  const canBuy = edition !== null && !isSoldOut(edition) && selection.max >= 1
  const soldOut = edition !== null && isSoldOut(edition)
  const cartFull = edition !== null && !soldOut && selection.max < 1
  const notice = addMessage ?? (soldOut ? SOLD_OUT_MESSAGE : cartFull ? CART_FULL_MESSAGE : null)

  const showReviews = () => {
    setTab('reviews')
    tabsRef.current?.scrollIntoView({ block: 'start' })
  }

  const goToCart = () => {
    void router.navigate({ to: '/cart' })
  }

  // One click, one request (DET-17): a ref guards against a second click before React re-renders.
  const submit = async (after: 'cart' | 'stay'): Promise<void> => {
    if (!edition || !canBuy || sending.current) return
    sending.current = true
    setAddMessage(null)
    try {
      await add.mutateAsync({ nftId: nft.id, editionId: edition.id, quantity: selection.quantity })
      if (after === 'cart') goToCart()
      else notifyAdded(goToCart)
    } catch (error) {
      const outcome = describeAddError(error, {
        nftId: nft.id,
        editionId: edition.id,
        inCart: selection.inCart,
      })
      if (outcome.kind !== 'failed' && outcome.kind !== 'session') {
        void queryClient.invalidateQueries({ queryKey: catalogKeys.detail(nft.id) })
      }
      if (outcome.kind === 'sold-out') setAddMessage(outcome.message)
      else if (outcome.kind === 'limit') {
        setAddMessage(outcome.message)
        selection.limitTo(outcome.remaining)
      } else if (outcome.kind === 'failed') {
        // The error has no inline slot of its own: a toast that repeats the same request.
        notifyAddError(outcome, () => {
          void submit(after)
        })
      } else if (outcome.kind === 'not-found') notify.error('Este NFT não está mais disponível.')
    } finally {
      sending.current = false
    }
  }

  return (
    <div className="mx-auto w-full max-w-150 pb-[var(--bottom-bar-inset,11.5rem)] lg:max-w-page lg:px-6 lg:pb-0">
      <Breadcrumb className="mb-3 hidden lg:block">
        <BreadcrumbList className="text-body-lg font-bold">
          <BreadcrumbItem>
            <BreadcrumbLink asChild className="text-foreground">
              <Link to="/">Início</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild className="text-foreground">
              <Link to="/" hash="mercado">
                Mercado
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="text-text-accent">{nft.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col lg:grid lg:grid-cols-[minmax(0,573fr)_minmax(0,595fr)] lg:gap-x-8">
        <Gallery nft={nft} className="px-6 lg:px-0" />

        <div className="relative -mt-16 flex flex-col gap-6 rounded-t-[30px] bg-surface-card px-6 pt-6 pb-10 lg:contents">
          <section className="flex min-w-0 flex-col gap-6 lg:gap-3.25">
            <div className="flex flex-col gap-3 lg:border-b lg:border-border lg:pb-3">
              <div className="flex items-start justify-between gap-3">
                <h1 className="text-title leading-7 font-bold text-foreground lg:text-[1.75rem] lg:leading-9.25">
                  {nft.name}
                </h1>
                <RatingChip
                  rating={nft.rating}
                  reviewCount={nft.reviewCount}
                  onShowReviews={showReviews}
                  className="lg:hidden"
                />
              </div>
              <PriceRating nft={nft} onShowReviews={showReviews} className="max-lg:hidden" />
            </div>

            <div className="flex flex-col gap-3">
              <h2 className="text-body-lg font-bold text-foreground max-lg:sr-only">
                Sobre este NFT:
              </h2>
              <p className="text-body text-text-secondary">{nft.description}</p>
            </div>

            <div className="flex flex-col gap-3">
              <p className="text-body-lg font-bold text-foreground" aria-hidden="true">
                Edição:
              </p>
              <EditionPicker
                editions={nft.editions}
                selected={selection.selectedId}
                onSelect={(id) => {
                  setAddMessage(null)
                  selection.selectEdition(id)
                }}
              />
              <div className="flex flex-col gap-1 text-caption-sm text-text-secondary">
                {edition ? (
                  <p>{editionCaption(edition, selection.inCart)}</p>
                ) : (
                  <p className="font-bold text-foreground">Esgotado</p>
                )}
                {notice && (
                  <p role={addMessage ? 'alert' : undefined} className="text-error">
                    {notice}
                  </p>
                )}
              </div>
            </div>

            {wide && (
              <PurchaseActions
                nft={nft}
                selection={selection}
                canBuy={canBuy}
                pending={add.isPending}
                onBuy={() => {
                  void submit('cart')
                }}
              />
            )}

            <MetaList nft={nft} />
            <ShareRow name={nft.name} className="max-lg:hidden" />
          </section>

          <DetailsTabs
            ref={tabsRef}
            nft={nft}
            tab={tab}
            onTabChange={setTab}
            className="lg:col-span-2 lg:mt-24"
          />
          <RelatedRow nftId={nft.id} className="lg:col-span-2 lg:mt-24" />
        </div>
      </div>

      {!wide && (
        <MobileBuyBar
          nft={nft}
          selection={selection}
          canBuy={canBuy}
          pending={add.isPending}
          onBuy={() => {
            void submit('cart')
          }}
          onAddToCart={() => {
            void submit('stay')
          }}
        />
      )}
    </div>
  )
}
