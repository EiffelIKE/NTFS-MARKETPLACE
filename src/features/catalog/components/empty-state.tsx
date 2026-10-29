import type * as React from 'react'

import { EmptyImageIcon } from '@/components/icons'

/** Empty results, the catalog's own empty state and a page that does not exist (CAT-12, CAT-17). */
export function EmptyState({
  title,
  hint,
  children,
}: {
  title: string
  hint: string
  children?: React.ReactNode
}) {
  return (
    <div
      data-testid="empty-state"
      className="flex flex-col items-center gap-3 rounded-md bg-surface-card px-6 py-16 text-center"
    >
      <EmptyImageIcon className="size-12 text-text-secondary" />
      <h3 className="text-title text-foreground">{title}</h3>
      <p className="max-w-sm text-body text-text-secondary">{hint}</p>
      {children}
    </div>
  )
}
