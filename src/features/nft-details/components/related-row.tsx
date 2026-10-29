import { useQuery } from '@tanstack/react-query'

import { AlertCircleIcon } from '@/components/icons'
import { Alert, AlertAction, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { relatedQuery } from '@/features/catalog/api/queries'
import { CardSkeleton } from '@/features/catalog/components/card-skeleton'
import { ProductCard } from '@/features/catalog/components/product-card'
import type { NftId } from '@/contracts'
import { LoadingRegion } from '@/components/loading-region'
import { cn } from '@/lib/utils'

// Five cards across on desktop (219 wide, gap 26 in Figma); a scroll-snap track below `lg`.
const trackClass =
  'flex snap-x snap-mandatory gap-4 overflow-x-auto [scrollbar-width:none] lg:grid lg:grid-cols-5 lg:gap-6.5 lg:overflow-visible'
const itemClass = 'w-[min(219px,60vw)] shrink-0 snap-start lg:w-auto'

/**
 * "Mais desta coleção" (DET-04, DET-08): loaded apart from the NFT, with its own skeleton and its
 * own inline retry, so a failure here never takes the page down. Hidden when there is nothing.
 */
export function RelatedRow({
  nftId,
  title = 'Mais desta coleção',
  hideOnError = false,
  className,
}: {
  nftId: NftId
  /** The cart reuses the row as "Colecionadores também viram" (spec 07). */
  title?: string
  /** Decorative rows (the cart's) show nothing when the request fails, instead of an alert. */
  hideOnError?: boolean
  className?: string
}) {
  const { data, isPending, isError, error, refetch } = useQuery(relatedQuery(nftId))
  if (data?.items.length === 0 || (hideOnError && isError)) return null

  return (
    <section aria-labelledby="related-title" className={cn('flex flex-col gap-6', className)}>
      <h2
        id="related-title"
        className="border-b border-border pb-1.5 text-body-lg font-bold text-text-accent"
      >
        {title}
      </h2>
      <LoadingRegion loading={isPending} label="Carregando NFTs relacionados">
        {isPending && (
          <ul aria-hidden="true" className={trackClass}>
            {Array.from({ length: 5 }, (_, index) => (
              <li key={index} className={itemClass}>
                <CardSkeleton variant="compact" />
              </li>
            ))}
          </ul>
        )}
        {isError && (
          <Alert>
            <AlertCircleIcon />
            <AlertDescription>
              Não foi possível carregar os NFTs relacionados. {error.message}
            </AlertDescription>
            <AlertAction>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void refetch()
                }}
              >
                Tentar novamente
              </Button>
            </AlertAction>
          </Alert>
        )}
        {data && (
          <ul className={trackClass}>
            {data.items.map((item) => (
              <li key={item.id} className={itemClass}>
                <ProductCard nft={item} variant="compact" />
              </li>
            ))}
          </ul>
        )}
      </LoadingRegion>
    </section>
  )
}
