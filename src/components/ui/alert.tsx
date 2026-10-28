import { cva, type VariantProps } from 'class-variance-authority'
import type * as React from 'react'

import { cn } from '@/lib/utils'

// Inline errors with an optional retry action (specs 05–10). The icon + title carry the state,
// not only the surface color.
const alertVariants = cva(
  "relative grid w-full gap-1 rounded-md px-4 py-3 text-left text-body text-foreground has-data-[slot=alert-action]:pr-36 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-3 *:[svg]:row-span-2 *:[svg]:mt-0.5 *:[svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        error: 'bg-error-surface *:[svg]:text-error',
        info: 'bg-surface-card *:[svg]:text-text-accent',
      },
    },
    defaultVariants: {
      variant: 'error',
    },
  },
)

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role={variant === 'info' ? 'status' : 'alert'}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="alert-title" className={cn('font-bold', className)} {...props} />
}

function AlertDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="alert-description" className={cn('text-foreground', className)} {...props} />
  )
}

function AlertAction({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-action"
      className={cn('absolute top-1/2 right-3 -translate-y-1/2', className)}
      {...props}
    />
  )
}

export { Alert, AlertAction, AlertDescription, AlertTitle }
