import { RadioGroup as RadioGroupPrimitive } from 'radix-ui'
import type * as React from 'react'

import { cn } from '@/lib/utils'

function RadioGroup({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return (
    <RadioGroupPrimitive.Root
      data-slot="radio-group"
      className={cn('grid w-full gap-3', className)}
      {...props}
    />
  )
}

/** Classic radio: 18 px ring; checked fills the ring and adds a center dot (DS-08). */
function RadioGroupItem({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-item"
      className={cn(
        'peer relative flex size-4.5 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-text-secondary after:absolute after:-inset-x-3 after:-inset-y-2 disabled:cursor-not-allowed disabled:border-disabled aria-invalid:border-error data-checked:border-primary',
        className,
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator
        data-slot="radio-group-indicator"
        className="size-2 rounded-full bg-primary"
      />
    </RadioGroupPrimitive.Item>
  )
}

const chipVariants = {
  // Filled when selected (wallets, networks).
  filled:
    'h-7 min-w-6 rounded-sm border border-border-soft bg-surface-dark px-3 text-caption font-normal text-text-secondary not-disabled:hover:text-foreground disabled:cursor-not-allowed disabled:text-disabled data-checked:border-primary data-checked:bg-primary data-checked:font-bold data-checked:text-ink',
  // Pill with a primary border and accent text when selected (the details editions, Figma).
  outline:
    'h-7 min-w-6 rounded-full border border-border-soft px-2 text-caption-sm font-normal text-text-secondary not-disabled:hover:text-foreground disabled:cursor-not-allowed disabled:text-disabled disabled:line-through data-checked:border-primary data-checked:font-bold data-checked:text-text-accent',
} as const

/**
 * Chip radio (editions, wallets, networks): selected state changes weight and border (and fill in
 * the `filled` variant), not only color (DS-08). A hidden bold copy reserves the width, so
 * selecting does not shift the row. A disabled `outline` chip is also struck through.
 */
function RadioGroupChip({
  className,
  children,
  variant = 'filled',
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item> & {
  variant?: keyof typeof chipVariants
}) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-chip"
      data-variant={variant}
      className={cn('inline-grid cursor-pointer items-center', chipVariants[variant], className)}
      {...props}
    >
      <span aria-hidden="true" className="invisible col-start-1 row-start-1 font-bold">
        {children}
      </span>
      <span className="col-start-1 row-start-1 text-center">{children}</span>
    </RadioGroupPrimitive.Item>
  )
}

export { RadioGroup, RadioGroupChip, RadioGroupItem }
