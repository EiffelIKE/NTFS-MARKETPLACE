import { useSelector } from '@tanstack/react-form'

import { AlertCircleIcon } from '@/components/icons'
import { Alert, AlertDescription } from '@/components/ui/alert'

import { useFormContext } from './form-context'
import { errorMessage } from './messages'

/**
 * A form-level failure (AUTH-03, AUTH-04) announced as `role="alert"`. It reads the form's
 * `onServer` error, which a new submit clears, so a retry never shows the previous failure.
 */
export function FormAlert({ className }: { className?: string }) {
  const form = useFormContext()
  const message = useSelector(form.store, (state) => errorMessage(state.errorMap.onServer))
  if (!message) return null
  return (
    <Alert variant="error" className={className}>
      <AlertCircleIcon />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}
