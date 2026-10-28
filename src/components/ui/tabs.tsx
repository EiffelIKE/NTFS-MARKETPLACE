import { Tabs as TabsPrimitive } from 'radix-ui'
import type * as React from 'react'

import { cn } from '@/lib/utils'

function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn('flex flex-col gap-6', className)}
      {...props}
    />
  )
}

/**
 * A horizontal scroller when the labels do not fit (DS-31). The baseline is an inset shadow, not a
 * border, so the active underline can sit on it without being clipped by the scroll box.
 */
function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        'flex w-full [scrollbar-width:none] items-end gap-6 overflow-x-auto shadow-[inset_0_-1px_0_var(--color-border)]',
        className,
      )}
      {...props}
    />
  )
}

/**
 * Active tab: accent color, bold weight and a 2 px underline (shape cue, DS-08). A hidden bold copy
 * reserves the width so the row does not shift. The outline is inset so the scroller never clips it.
 */
function TabsTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        'relative inline-grid shrink-0 cursor-pointer px-1 pt-1 pb-3 text-body-lg whitespace-nowrap text-foreground -outline-offset-2 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-transparent not-disabled:hover:text-text-accent disabled:cursor-not-allowed disabled:text-disabled data-active:font-bold data-active:text-text-accent data-active:after:bg-text-accent',
        className,
      )}
      {...props}
    >
      <span aria-hidden="true" className="invisible col-start-1 row-start-1 font-bold">
        {children}
      </span>
      <span className="col-start-1 row-start-1">{children}</span>
    </TabsPrimitive.Trigger>
  )
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content data-slot="tabs-content" className={cn(className)} {...props} />
}

export { Tabs, TabsContent, TabsList, TabsTrigger }
