import type * as React from 'react'

import { useFieldControl } from '@/components/ui/field'
import { cn } from '@/lib/utils'

// Shared text-field look (spec 01 design §6): also used by `Textarea` and `InputGroup`.
const fieldSurface =
  'w-full min-w-0 rounded-sm border border-transparent bg-surface-dark text-body text-foreground placeholder:text-secondary disabled:cursor-not-allowed disabled:text-disabled disabled:placeholder:text-disabled aria-invalid:border-error'

function Input({
  className,
  type,
  id,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  ...props
}: React.ComponentProps<'input'>) {
  const field = useFieldControl({
    id,
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': ariaInvalid,
  })
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(fieldSurface, 'h-10 px-3', className)}
      {...field}
      {...props}
    />
  )
}

export { fieldSurface, Input }
