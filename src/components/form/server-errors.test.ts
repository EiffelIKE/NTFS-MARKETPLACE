import { FieldApi, FormApi, type AnyFieldApi, type AnyFormApi } from '@tanstack/react-form'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { ApiError } from '@/lib/http/errors'

import {
  applyServerErrors,
  clearServerError,
  clearServerErrors,
  setFormError,
} from './server-errors'
import { submitForm } from './submit'
import { formValidation } from './validation'
import { errorMessage } from './messages'

const Schema = z.object({
  username: z.string().min(3, 'Use pelo menos 3 caracteres.'),
  email: z.email('E-mail inválido.'),
  password: z.string().min(8, 'Use pelo menos 8 caracteres.'),
})

function setup(onSubmit: () => unknown = () => undefined) {
  // The library's `Any*` types are what the helpers take; a concrete `FormApi` is not assignable.
  const form = new FormApi({
    defaultValues: { username: '', email: '', password: '' },
    validators: { onDynamic: Schema },
    validationLogic: formValidation(),
    onSubmit,
  }) as unknown as AnyFormApi
  form.mount()
  const field = (name: string): AnyFieldApi => {
    const api = new FieldApi({ form, name }) as unknown as AnyFieldApi
    api.mount()
    return api
  }
  return {
    form,
    fields: { username: field('username'), email: field('email'), password: field('password') },
  }
}

const http = (code: string, message: string, fields?: Record<string, string[]>, status = 409) =>
  new ApiError('http', message, { status, code: code as never, fields })

const messagesOf = (field: AnyFieldApi) => field.state.meta.errors.map(errorMessage)

describe('applyServerErrors', () => {
  it('maps a code to its field and keeps the API message', () => {
    const { form, fields } = setup()
    const applied = applyServerErrors(form, http('EMAIL_TAKEN', 'Este e-mail já está em uso.'), {
      EMAIL_TAKEN: 'email',
    })
    expect(applied).toBe(true)
    expect(messagesOf(fields.email)).toEqual(['Este e-mail já está em uso.'])
    expect(messagesOf(fields.username)).toEqual([])
  })

  it('maps `fields` by path, first message per field', () => {
    const { form, fields } = setup()
    const applied = applyServerErrors(
      form,
      http(
        'VALIDATION_FAILED',
        'Dados inválidos.',
        {
          username: ['Nome inválido.', 'outra'],
          password: ['Senha fraca.'],
        },
        422,
      ),
    )
    expect(applied).toBe(true)
    expect(messagesOf(fields.username)).toEqual(['Nome inválido.'])
    expect(messagesOf(fields.password)).toEqual(['Senha fraca.'])
  })

  it('ignores field paths the form does not have', () => {
    const { form } = setup()
    expect(
      applyServerErrors(form, http('VALIDATION_FAILED', 'x', { _: ['Corpo inválido.'] }, 422)),
    ).toBe(false)
  })

  it('returns false for an unmapped code, a non-http error and a non-error', () => {
    const { form } = setup()
    expect(applyServerErrors(form, http('INTERNAL', 'x', undefined, 500))).toBe(false)
    expect(applyServerErrors(form, new ApiError('network', 'offline'))).toBe(false)
    expect(applyServerErrors(form, new Error('x'))).toBe(false)
    expect(applyServerErrors(form, undefined)).toBe(false)
  })

  it('a server error makes the form invalid until the field is edited', () => {
    const { form, fields } = setup()
    applyServerErrors(form, http('USERNAME_TAKEN', 'Nome em uso.'), { USERNAME_TAKEN: 'username' })
    expect(form.state.isFieldsValid).toBe(false)
    clearServerError(fields.username)
    expect(messagesOf(fields.username)).toEqual([])
    expect(form.state.isFieldsValid).toBe(true)
  })

  it('clearing a field without a server error changes nothing', () => {
    const { fields } = setup()
    const before = fields.email.state.meta
    clearServerError(fields.email)
    expect(fields.email.state.meta).toBe(before)
  })

  it('clearing before a submit lets it through', async () => {
    const { form, fields } = setup()
    form.setFieldValue('username', 'anasouza')
    form.setFieldValue('email', 'ana@x.test')
    form.setFieldValue('password', 'Senha1234')
    applyServerErrors(form, http('EMAIL_TAKEN', 'Em uso.'), { EMAIL_TAKEN: 'email' })
    expect(messagesOf(fields.email)).toEqual(['Em uso.'])
    // Left alone, the stale error would keep the form invalid and block the submit.
    await form.handleSubmit()
    expect(form.state.submissionAttempts).toBe(1)
    expect(form.state.isSubmitted).toBe(false)
    clearServerErrors(form)
    await form.handleSubmit()
    expect(form.state.isSubmitted).toBe(true)
    expect(messagesOf(fields.email)).toEqual([])
    expect(form.state.submissionAttempts).toBe(2)
  })
})

describe('setFormError', () => {
  it('sets a form-level message that clearing removes, so the next submit can run', async () => {
    const { form } = setup()
    form.setFieldValue('username', 'anasouza')
    form.setFieldValue('email', 'ana@x.test')
    form.setFieldValue('password', 'Senha1234')
    setFormError(form, 'Falhou.')
    expect(errorMessage(form.state.errorMap.onServer)).toBe('Falhou.')
    clearServerErrors(form)
    expect(form.state.errorMap.onServer).toBeUndefined()
    await form.handleSubmit()
    expect(form.state.isSubmitted).toBe(true)
  })
})

describe('validation timing (AUTH-01)', () => {
  it('before a submit: validates on blur, not on change', () => {
    const { fields } = setup()
    fields.email.handleChange('x')
    expect(messagesOf(fields.email)).toEqual([])
    fields.email.handleBlur()
    expect(messagesOf(fields.email)).toEqual(['E-mail inválido.'])
  })

  it('after a failed submit: revalidates on every change', async () => {
    const { form, fields } = setup()
    await form.handleSubmit()
    expect(form.state.submissionAttempts).toBe(1)
    expect(messagesOf(fields.email)).toEqual(['E-mail inválido.'])
    fields.email.handleChange('ana@x.test')
    expect(messagesOf(fields.email)).toEqual([])
    fields.email.handleChange('ana')
    expect(messagesOf(fields.email)).toEqual(['E-mail inválido.'])
  })
})

describe('errorMessage', () => {
  it('reads strings and issue objects', () => {
    expect(errorMessage('x')).toBe('x')
    expect(errorMessage({ message: 'y', path: [] })).toBe('y')
    expect(errorMessage('')).toBeUndefined()
    expect(errorMessage(undefined)).toBeUndefined()
    expect(errorMessage({ message: 3 })).toBeUndefined()
  })
})

describe('submitForm', () => {
  it('a blur error the user has fixed does not block the first submit', async () => {
    const onSubmit = vi.fn()
    const { form, fields } = setup(onSubmit)
    fields.password.handleBlur()
    expect(messagesOf(fields.password)).toEqual(['Use pelo menos 8 caracteres.'])
    form.setFieldValue('username', 'anasouza')
    form.setFieldValue('email', 'ana@x.test')
    fields.password.handleChange('Senha1234')

    // The library alone refuses with the stale message...
    await form.handleSubmit()
    expect(onSubmit).not.toHaveBeenCalled()
    form.reset({ username: 'anasouza', email: 'ana@x.test', password: 'Senha1234' })
    fields.password.handleBlur()
    fields.password.handleChange('x')
    fields.password.handleChange('Senha1234')

    // ...and `submitForm` re-validates first.
    await submitForm(form)
    expect(onSubmit).toHaveBeenCalledOnce()
  })

  it('ignores a call while a submit is running', async () => {
    let release: () => void = () => undefined
    const onSubmit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve
        }),
    )
    const { form } = setup(onSubmit)
    form.setFieldValue('username', 'anasouza')
    form.setFieldValue('email', 'ana@x.test')
    form.setFieldValue('password', 'Senha1234')
    const first = submitForm(form)
    await vi.waitFor(() => {
      expect(onSubmit).toHaveBeenCalledOnce()
    })
    await submitForm(form)
    expect(onSubmit).toHaveBeenCalledOnce()
    release()
    await first
  })
})
