import type * as React from 'react'

import { useFieldControl } from '@/components/ui/field'
import { fieldSurface } from '@/components/ui/input'
import { cn } from '@/lib/utils'

function Textarea({
  className,
  id,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  ...props
}: React.ComponentProps<'textarea'>) {
  const field = useFieldControl({
    id,
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': ariaInvalid,
  })
  return (
    <textarea
      data-slot="textarea"
      className={cn(fieldSurface, 'field-sizing-content min-h-24 px-3 py-2', className)}
      {...field}
      {...props}
    />
  )
}

export { Textarea }
