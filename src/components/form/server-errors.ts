import type { AnyFieldApi, AnyFormApi } from '@tanstack/react-form'

import type { ApiErrorCode } from '@/contracts'
import { ApiError } from '@/lib/http/errors'

type ErrorMap = Record<string, unknown>

/**
 * Puts a server rejection on the fields it names (AUTH-02, ACC, CHK): `error.fields` by dotted path,
 * plus `codeToField` for codes that carry no field map (`EMAIL_TAKEN` → `email`). The text is the
 * API's own pt-BR message. Returns `false` when nothing matched, so the caller shows a form-level
 * alert instead.
 */
export function applyServerErrors(
  form: AnyFormApi,
  error: unknown,
  codeToField: Partial<Record<ApiErrorCode, string>> = {},
): boolean {
  if (!(error instanceof ApiError) || error.kind !== 'http') return false

  const messages = new Map<string, string>()
  for (const [path, list] of Object.entries(error.fields ?? {})) {
    const message = list[0]
    if (message && form.getFieldMeta(path) !== undefined) messages.set(path, message)
  }
  const mapped = error.code ? codeToField[error.code] : undefined
  if (mapped && !messages.has(mapped)) messages.set(mapped, error.message)
  if (messages.size === 0) return false

  for (const [name, message] of messages) {
    form.setFieldMeta(name, (meta) => ({
      ...meta,
      errorMap: { ...(meta.errorMap as ErrorMap), onServer: message },
    }))
  }
  return true
}

/** Editing a field clears its server error: the message was about the value that is gone. */
export function clearServerError(field: AnyFieldApi): void {
  if ((field.state.meta.errorMap as ErrorMap).onServer === undefined) return
  field.setMeta((meta) => ({
    ...meta,
    errorMap: { ...(meta.errorMap as ErrorMap), onServer: undefined },
  }))
}

/** A form-level failure (`FormAlert`); the next submit clears it. */
export function setFormError(form: AnyFormApi, message: string): void {
  form.setErrorMap({ onServer: message })
}

/**
 * Drops every server error, form-level and per field. Call it when the user submits again: an
 * unedited field would otherwise keep the form invalid, and `handleSubmit` would never run.
 */
export function clearServerErrors(form: AnyFormApi): void {
  if ((form.state.errorMap as ErrorMap).onServer !== undefined) {
    form.setErrorMap({ onServer: undefined })
  }
  for (const name of Object.keys(form.state.values as object)) {
    // A value without an input of its own (checkout's `walletId`) has no meta to clean.
    if (form.getFieldMeta(name) === undefined) continue
    form.setFieldMeta(name, (meta) =>
      (meta.errorMap as ErrorMap).onServer === undefined
        ? meta
        : { ...meta, errorMap: { ...(meta.errorMap as ErrorMap), onServer: undefined } },
    )
  }
}
