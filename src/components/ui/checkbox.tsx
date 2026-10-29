import { Checkbox as CheckboxPrimitive } from 'radix-ui'
import type * as React from 'react'

import { CheckIcon } from '@/components/icons'
import { useFieldControl } from '@/components/ui/field'
import { cn } from '@/lib/utils'

// 18 px box with a 2 px high-contrast border; checked adds a fill and a check (DS-08).
// The `after` pseudo-element widens the hit area (DS-16).
function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  const field = useFieldControl(props)
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        'peer relative flex size-4.5 shrink-0 cursor-pointer items-center justify-center rounded-xs border-2 border-text-secondary text-ink after:absolute after:-inset-x-3 after:-inset-y-2 disabled:cursor-not-allowed disabled:border-disabled aria-invalid:border-error data-checked:border-primary data-checked:bg-primary disabled:data-checked:border-disabled disabled:data-checked:bg-disabled',
        className,
      )}
      {...props}
      {...field}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center"
      >
        <CheckIcon className="size-3.5 stroke-[2.5]" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
