import type * as React from 'react'

import { cn } from '@/lib/utils'

/** First focusable element; hidden until focused (DS-30). */
export function SkipLink({ className, children, ...props }: React.ComponentProps<'a'>) {
  return (
    <a
      className={cn(
        'sr-only z-60 rounded-sm bg-primary px-4 py-2 text-body font-bold text-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3',
        className,
      )}
      {...props}
    >
      {children}
    </a>
  )
}
