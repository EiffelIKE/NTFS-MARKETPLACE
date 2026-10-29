import type { AnyFormApi } from '@tanstack/react-form'

import { clearServerErrors } from './server-errors'

/**
 * The `<form onSubmit>` body shared by every form. It drops the previous server errors and
 * re-validates first: a blur-time error that the user has since fixed would otherwise make the
 * library refuse the first submit with the stale message. Ignored while a submit is running, so
 * repeated clicks and Enter presses send one request (AUTH-05).
 */
export async function submitForm(form: AnyFormApi): Promise<void> {
  if (form.state.isSubmitting) return
  clearServerErrors(form)
  await form.validate('submit')
  await form.handleSubmit()
}
