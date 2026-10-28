import { useSelector } from '@tanstack/react-form'
import type * as React from 'react'

import { Button } from '@/components/ui/button'

import { useFormContext } from './form-context'

/**
 * The form's submit button (AUTH-05): while the submit handler runs it shows the loading state and
 * ignores activation, so Enter and repeated clicks send one request at most.
 */
export function SubmitButton({
  children,
  ...props
}: Omit<React.ComponentProps<typeof Button>, 'type' | 'loading'>) {
  const form = useFormContext()
  const isSubmitting = useSelector(form.store, (state) => state.isSubmitting)
  return (
    <Button type="submit" loading={isSubmitting} {...props}>
      {children}
    </Button>
  )
}
