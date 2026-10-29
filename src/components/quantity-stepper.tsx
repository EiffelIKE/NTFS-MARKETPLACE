import { MinusIcon, PlusIcon } from '@/components/icons'
import { cn } from '@/lib/utils'

const stepClass =
  'relative flex shrink-0 cursor-pointer items-center justify-center bg-primary text-ink not-disabled:hover:bg-text-accent disabled:cursor-not-allowed disabled:bg-surface-dark disabled:text-disabled after:absolute after:-inset-2'

const sizes = {
  // Desktop details (Figma): round primary buttons around the value.
  md: {
    step: 'h-12 w-7.75 rounded-full [&_svg]:size-4.5',
    value: 'min-w-4 text-body-lg',
    gap: 'gap-3',
  },
  // Mobile details buy bar (Figma): 18 × 28 pills.
  pill: { step: 'h-7 w-4.5 rounded-full [&_svg]:size-3', value: 'min-w-3 text-body', gap: 'gap-2' },
  // Mobile cart cards (Figma): 22 px rounded squares.
  sm: { step: 'size-5.5 rounded-sm [&_svg]:size-3', value: 'min-w-3 text-body', gap: 'gap-2' },
} as const

export interface QuantityStepperProps {
  value: number
  min: number
  max: number
  onChange: (value: number) => void
  size?: keyof typeof sizes
  /** Names the group, e.g. "Quantidade de Emerald Ape #042". */
  label?: string
  /** Names of the two buttons; the cart says which line they act on (spec 07, CART-25). */
  decreaseLabel?: string
  increaseLabel?: string
  /** Id of the element that explains a limit (it describes the group). */
  describedBy?: string | undefined
  disabled?: boolean
  className?: string
}

/**
 * Integer quantity control (shared by details and cart). Both buttons are disabled at the bounds,
 * and the value is a live `output`, so a screen reader hears the new quantity after each change.
 */
export function QuantityStepper({
  value,
  min,
  max,
  onChange,
  size = 'md',
  label = 'Quantidade',
  decreaseLabel = 'Diminuir quantidade',
  increaseLabel = 'Aumentar quantidade',
  describedBy,
  disabled = false,
  className,
}: QuantityStepperProps) {
  const look = sizes[size]
  return (
    <div
      role="group"
      aria-label={label}
      aria-describedby={describedBy}
      className={cn('flex items-center', look.gap, className)}
    >
      <button
        type="button"
        aria-label={decreaseLabel}
        disabled={disabled || value <= min}
        className={cn(stepClass, look.step)}
        onClick={() => {
          onChange(value - 1)
        }}
      >
        <MinusIcon />
      </button>
      <output
        aria-live="polite"
        aria-label="Quantidade"
        className={cn('text-center font-medium text-foreground tabular-nums', look.value)}
      >
        {value}
      </output>
      <button
        type="button"
        aria-label={increaseLabel}
        disabled={disabled || value >= max}
        className={cn(stepClass, look.step)}
        onClick={() => {
          onChange(value + 1)
        }}
      >
        <PlusIcon />
      </button>
    </div>
  )
}
