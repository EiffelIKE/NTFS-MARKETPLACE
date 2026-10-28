import type * as React from 'react'

import { cn } from '@/lib/utils'

/** Shimmer placeholder (DS-21). Size it like the final content; it is hidden from assistive tech. */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn('skeleton rounded-sm', className)}
      {...props}
    />
  )
}

export { Skeleton }
