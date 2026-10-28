import type { NftSummary } from '@/contracts'
import { cn } from '@/lib/utils'

import { CardSkeleton } from './card-skeleton'
import { DetailsAction, ProductCard } from './product-card'

// 3 columns from `lg` (258 wide, gaps 34 / 72), a staggered 2-column grid below `md` (right column
// offset by 32, Figma mobile) and 3 plain columns in between (CAT-26).
const gridClass =
  'grid grid-cols-2 gap-x-4 gap-y-6 pb-8 max-md:[&>li:nth-child(even)]:translate-y-8 md:grid-cols-3 md:gap-x-6 md:pb-0 lg:gap-x-8.5 lg:gap-y-18'

export function ProductGrid({ items }: { items: NftSummary[] }) {
  return (
    <ul className={gridClass}>
      {items.map((nft) => (
        <li key={nft.id}>
          <ProductCard nft={nft} actions={<DetailsAction nft={nft} />} />
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
