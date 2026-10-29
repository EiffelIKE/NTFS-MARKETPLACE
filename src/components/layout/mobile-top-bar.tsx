import { useCanGoBack, useRouter } from '@tanstack/react-router'
import type * as React from 'react'

import { ArrowLeftIcon } from '@/components/icons'
import { cn } from '@/lib/utils'

import { PageContainer } from './page-container'

export interface MobileTopBarProps extends React.ComponentProps<'header'> {
  title?: string | undefined
  /** Right-hand control (e.g. the details favorite button, spec 06). */
  trailing?: React.ReactNode
  /** 10 px closer to the top: Figma's details frame centers the circles at y 40, the others at 50. */
  raised?: boolean | undefined
}

/**
 * Compact bar on mobile inner screens (decision 6). The title is visual only: pages keep their own
 * `h1`, so the bar title is hidden from assistive tech.
 */
export function MobileTopBar({ title, trailing, raised, className, ...props }: MobileTopBarProps) {
  const router = useRouter()
  const canGoBack = useCanGoBack()

  return (
    <header className={cn(raised ? 'pt-3' : 'pt-5.5', className)} {...props}>
      <PageContainer className="grid h-14 grid-cols-[40px_1fr_40px] items-center gap-2">
        <button
          type="button"
          aria-label="Voltar"
          className="relative flex size-8.75 cursor-pointer items-center justify-center justify-self-center rounded-full border border-primary/20 bg-surface-raised text-text-secondary after:absolute after:-inset-1"
          onClick={() => {
            if (canGoBack) router.history.back()
            else void router.navigate({ to: '/' })
          }}
        >
          <ArrowLeftIcon className="h-3.5 w-2" />
        </button>
        <p aria-hidden="true" className="truncate text-center text-title text-foreground">
          {title}
        </p>
        <div className="flex justify-center">{trailing}</div>
      </PageContainer>
    </header>
  )
}
