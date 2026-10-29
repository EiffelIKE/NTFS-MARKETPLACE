import { LoadingRegion } from '@/components/loading-region'
import { Skeleton } from '@/components/ui/skeleton'
import { CardSkeleton } from '@/features/catalog/components/card-skeleton'
import { cn } from '@/lib/utils'

import { galleryMainClass } from './gallery'

/**
 * The details layout at its final sizes (DET-03): the same grid, gallery box, sheet and rows as
 * the page, so nothing moves when the data arrives. Everything inside is decorative for assistive
 * tech; the region announces "Carregando NFT" once.
 */
export function DetailsSkeleton() {
  return (
    <LoadingRegion
      loading
      label="Carregando NFT"
      className="mx-auto w-full max-w-150 pb-[var(--bottom-bar-inset,11.5rem)] lg:max-w-page lg:px-6 lg:pb-0"
    >
      <Skeleton className="mb-3 hidden h-5.5 w-48 lg:block" />
      <div className="flex flex-col lg:grid lg:grid-cols-[minmax(0,573fr)_minmax(0,595fr)] lg:gap-x-8">
        <div className="lg:flex lg:gap-7">
          <div className="hidden w-25 shrink-0 flex-col gap-4 lg:flex">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="aspect-square w-full rounded-md" />
            ))}
          </div>
          {/* The same box as the page's, so the gutter and the size match exactly. */}
          <div
            data-testid="gallery-main"
            className={cn(galleryMainClass, 'bg-transparent px-6 lg:bg-transparent lg:p-0')}
          >
            <Skeleton className="size-full rounded-card-mobile lg:rounded-none" />
          </div>
        </div>
        <div className="relative -mt-16 flex flex-col gap-6 rounded-t-[30px] bg-surface-card px-6 pt-6 pb-10 lg:contents">
          <div className="flex min-w-0 flex-col gap-6 lg:gap-3.25">
            <div className="flex flex-col gap-3 lg:gap-2 lg:border-b lg:border-border lg:pb-3">
              <div className="flex items-start justify-between gap-3">
                <Skeleton className="h-7 w-3/5 lg:h-9.25" />
                <Skeleton className="h-7 w-16 rounded-full lg:hidden" />
              </div>
              <Skeleton className="h-6 w-full max-lg:hidden" />
            </div>
            <div className="flex flex-col gap-2">
              <Skeleton className="h-5.5 w-full" />
              <Skeleton className="h-5.5 w-full" />
              <Skeleton className="h-5.5 w-2/3" />
            </div>
            <div className="flex flex-col gap-3">
              <Skeleton className="h-5 w-16" />
              <div className="flex gap-1.5">
                {Array.from({ length: 4 }, (_, index) => (
                  <Skeleton key={index} className="h-7 w-14 rounded-full" />
                ))}
              </div>
              <Skeleton className="h-4.5 w-64" />
            </div>
            <Skeleton className="h-12 w-full max-lg:hidden" />
            <div className="flex flex-col gap-3">
              <Skeleton className="h-5.5 w-40" />
              <Skeleton className="h-5.5 w-48" />
              <Skeleton className="h-5.5 w-64" />
            </div>
          </div>
          <Skeleton className="h-40 w-full lg:col-span-2 lg:mt-24" />
          <ul
            aria-hidden="true"
            className="flex gap-4 overflow-hidden lg:col-span-2 lg:mt-24 lg:grid lg:grid-cols-5 lg:gap-6.5"
          >
            {Array.from({ length: 5 }, (_, index) => (
              <li key={index} className="w-[min(219px,60vw)] shrink-0 lg:w-auto">
                <CardSkeleton variant="compact" />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </LoadingRegion>
  )
}
