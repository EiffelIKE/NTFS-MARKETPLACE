import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import type * as React from 'react'

import { SpinnerIcon } from '@/components/icons'
import { cn } from '@/lib/utils'

// Spec 01 design §6. Focus uses the global `:focus-visible` ring (base.css).
const buttonVariants = cva(
  "group/button relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-sm border border-transparent whitespace-nowrap transition-colors select-none disabled:cursor-not-allowed aria-disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        primary:
          'bg-primary font-bold text-ink not-disabled:not-aria-disabled:hover:bg-text-accent disabled:bg-surface-dark disabled:text-disabled',
        secondary:
          'border-border-soft bg-surface-dark text-foreground not-disabled:not-aria-disabled:hover:bg-surface-raised disabled:text-disabled',
        outline:
          'border-primary bg-transparent text-text-accent not-disabled:not-aria-disabled:hover:bg-surface-dark disabled:border-disabled disabled:text-disabled',
        ghost:
          'bg-transparent text-foreground not-disabled:not-aria-disabled:hover:bg-surface-dark disabled:text-disabled',
        link: 'h-auto! bg-transparent px-0! text-text-accent underline-offset-4 not-disabled:not-aria-disabled:hover:underline disabled:text-disabled',
      },
      size: {
        sm: 'h-8.75 px-4 text-body-lg font-medium',
        default: 'h-10 px-7 text-body-lg',
        icon: 'size-10',
        'icon-lg': 'size-11.25 rounded-icon-button',
      },
    },
    compoundVariants: [
      // Mobile filter button: gradient fill (Figma `primary-soft`).
      { variant: 'primary', size: 'icon-lg', className: 'bg-primary-soft' },
    ],
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  },
)

type ButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    /**
     * Pending state (DS-20): a spinner takes the place of the leading icon (`data-icon="inline-start"`)
     * or sits in the left padding, the label stays, and activation is ignored while focus stays.
     */
    loading?: boolean
  }

function Button({
  className,
  variant = 'primary',
  size = 'default',
  asChild = false,
  loading = false,
  children,
  onClick,
  ...props
}: ButtonProps) {
  const shared = {
    'data-slot': 'button',
    'data-variant': variant,
    'data-size': size,
    className: cn(
      buttonVariants({ variant, size }),
      'active:not-disabled:not-aria-disabled:translate-y-px motion-reduce:active:translate-y-0',
      loading && '[&>[data-icon=inline-start]]:hidden',
      className,
    ),
  }

  if (asChild) {
    return (
      <Slot.Root {...shared} onClick={onClick} {...props}>
        {children}
      </Slot.Root>
    )
  }

  return (
    <button
      {...props}
      {...shared}
      data-loading={loading || undefined}
      aria-busy={loading || undefined}
      aria-disabled={loading || props['aria-disabled']}
      onClick={(event) => {
        if (loading) {
          event.preventDefault()
          return
        }
        onClick?.(event)
      }}
    >
      {loading && (
        <SpinnerIcon
          data-icon="spinner"
          className="absolute left-2 size-4 group-has-[>[data-icon=inline-start]]/button:static"
        />
      )}
      {children}
    </button>
  )
}

export { Button, buttonVariants, type ButtonProps }
