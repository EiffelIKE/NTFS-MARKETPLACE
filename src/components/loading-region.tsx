import type * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Wraps a region while it loads (DS-22): `aria-busy` on the region, one visually hidden status
 * label, skeletons hidden from assistive tech (the `Skeleton` component does that itself).
 */
export function LoadingRegion({
  loading,
  label,
  className,
  children,
  ...props
}: React.ComponentProps<'div'> & { loading: boolean; label: string }) {
  return (
    <div aria-busy={loading} className={cn(className)} {...props}>
      <span role="status" className="sr-only">
        {loading ? label : ''}
      </span>
      {children}
    </div>
  )
}
