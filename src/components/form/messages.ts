import type { AnyFieldApi } from '@tanstack/react-form'
import { useSelector } from '@tanstack/react-form'

/** An error entry as the form library stores it: a string, or a Standard Schema issue. */
export function errorMessage(error: unknown): string | undefined {
  if (typeof error === 'string') return error || undefined
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const { message } = error
    return typeof message === 'string' && message ? message : undefined
  }
  return undefined
}

/**
 * The message a field shows (AUTH-01): only after the field was left or a submit was attempted, so
 * the user is not scolded while typing the first time. A server error always shows, since it can
 * only exist after a submit.
 */
export function useFieldMessage(field: AnyFieldApi): string | undefined {
  const attempts = useSelector(field.form.store, (state) => state.submissionAttempts)
  const { isBlurred, errors } = field.state.meta
  if (!isBlurred && attempts === 0) return undefined
  for (const error of errors) {
    const message = errorMessage(error)
    if (message) return message
  }
  return undefined
}
