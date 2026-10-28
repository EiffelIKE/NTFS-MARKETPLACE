import type * as React from 'react'

import { cn } from '@/lib/utils'

/** 1200 content column with a 24 gutter inside; at 1440 the outer space is 120, as in Figma. */
export function PageContainer({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('mx-auto w-full max-w-page px-6', className)} {...props} />
}
