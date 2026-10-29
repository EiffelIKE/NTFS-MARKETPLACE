import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import type * as React from 'react'

import { cn } from '@/lib/utils'

const badgeVariants = cva('inline-flex shrink-0 items-center justify-center whitespace-nowrap', {
  variants: {
    variant: {
      /** Cart count bubble (16 px circle). */
      count: 'size-4 rounded-full bg-primary text-tiny text-ink',
      /** Rarity tag on product cards (spec 05). */
      rarity: 'h-6 rounded-xs bg-primary px-2 text-caption font-medium text-ink',
    },
  },
  defaultVariants: {
    variant: 'rarity',
  },
})

function Badge({
  className,
  variant = 'rarity',
  asChild = false,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'span'

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
