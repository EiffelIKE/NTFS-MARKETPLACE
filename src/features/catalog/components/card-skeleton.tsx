import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

import { cardMediaShape, compactMediaShape } from './product-card'

/** A card the size of a real one (CAT-14): same media box, a name line and a price line. */
export function CardSkeleton({
  variant = 'grid',
  className,
}: {
  variant?: 'grid' | 'compact'
  className?: string
}) {
  const compact = variant === 'compact'
  return (
    <div className={cn('flex flex-col gap-2', !compact && 'lg:gap-3', className)}>
      <Skeleton className={cn('w-full', compact ? compactMediaShape : cardMediaShape)} />
      <div className={cn('flex flex-col gap-1.5 px-2', !compact && 'lg:px-0')}>
        <Skeleton className="h-5.5 w-3/4" />
        <Skeleton className="h-6 w-1/2" />
      </div>
    </div>
  )
}
