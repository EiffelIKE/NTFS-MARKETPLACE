import type { NftSummary } from '@/contracts'
import { useMediaQuery } from '@/hooks/use-media-query'
import { cn } from '@/lib/utils'

import { CardCartAction } from '@/features/cart/components/card-cart-action'
import { FavoriteButton } from '@/features/favorites/components/favorite-button'

import { CardSkeleton } from './card-skeleton'
import { DetailsAction, ProductCard } from './product-card'

// 3 columns from `lg` (258 wide, gaps 34 / 72), a staggered 2-column grid below `md` (right column
// offset by 32, Figma mobile) and 3 plain columns in between (CAT-26).
const gridClass =
  'grid grid-cols-2 gap-x-4 gap-y-6 pb-8 max-md:[&>li:nth-child(even)]:translate-y-8 md:grid-cols-3 md:gap-x-6 md:pb-0 lg:gap-x-8.5 lg:gap-y-18'

/** The 2-column grid, below the `md` breakpoint. From `md` up the hero is the only LCP candidate. */
const PHONE_MEDIA = '(max-width: 767px)'
/**
 * Cards that intersect the first phone viewport. At Lighthouse's 412 x 823 the first four start at
 * 385, 417, 652 and 684 px (the right column is offset by 32), and which of them paints first, and
 * so becomes the LCP, varies between runs: every one of them counts as above the fold.
 */
const ABOVE_THE_FOLD_CARDS = 4

export function ProductGrid({ items }: { items: NftSummary[] }) {
  // On a phone the first cards are in the first viewport, so they load eagerly at high priority
  // (CAT-23). From `md` up they sit below the hero, which stays the only eager image there: raising
  // them would make them compete with it.
  const phone = useMediaQuery(PHONE_MEDIA)
  return (
    <ul className={gridClass}>
      {items.map((nft, index) => (
        <li key={nft.id}>
          <ProductCard
            nft={nft}
            priority={phone && index < ABOVE_THE_FOLD_CARDS}
            cornerAction={<FavoriteButton nft={nft} variant="card-mobile" />}
            actions={
              <>
                <CardCartAction nft={nft} />
                <FavoriteButton nft={nft} variant="card-desktop" />
                <DetailsAction nft={nft} />
              </>
            }
          />
        </li>
      ))}
    </ul>
  )
}

export function GridSkeleton({ className }: { className?: string }) {
  return (
    <ul aria-hidden="true" className={cn(gridClass, className)}>
      {Array.from({ length: 9 }, (_, index) => (
        <li key={index}>
          <CardSkeleton />
        </li>
      ))}
    </ul>
  )
}
