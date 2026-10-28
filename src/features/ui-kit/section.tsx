import type * as React from 'react'

import { cn } from '@/lib/utils'

/** Gallery section with a heading, so axe `region` / `heading-order` checks have structure. */
export function Section({
  id,
  title,
  className,
  children,
}: {
  id: string
  title: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4 border-t border-border pt-6">
      <h2 id={id} className="text-heading text-foreground">
        {title}
      </h2>
      <div className={cn('flex flex-wrap items-center gap-4', className)}>{children}</div>
    </section>
  )
}
