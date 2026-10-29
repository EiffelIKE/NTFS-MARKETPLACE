import * as React from 'react'

import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { focusFirstInvalid } from '@/lib/forms'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Footer newsletter (DS-29): validates the e-mail, then says the feature is unavailable. Nothing is
 * sent and no success wording is shown.
 */
export function NewsletterForm() {
  const [error, setError] = React.useState<string | null>(null)
  const [notice, setNotice] = React.useState(false)

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        const form = event.currentTarget
        const email = new FormData(form).get('email')
        if (typeof email !== 'string' || !EMAIL.test(email.trim())) {
          setNotice(false)
          setError('Digite um e-mail válido.')
          requestAnimationFrame(() => focusFirstInvalid(form))
          return
        }
        setError(null)
        setNotice(true)
      }}
    >
      <Field invalid={error !== null}>
        <FieldLabel className="sr-only">E-mail para a newsletter</FieldLabel>
        <InputGroup className="shadow-input">
          <InputGroupInput
            name="email"
            type="email"
            autoComplete="email"
            placeholder="digite seu e-mail..."
            onChange={() => {
              if (error) setError(null)
            }}
          />
          <InputGroupAddon align="inline-end" className="h-full">
            <button
              type="submit"
              className="h-full w-21.25 cursor-pointer rounded-r-sm bg-primary text-title text-ink hover:bg-text-accent"
            >
              Enviar
            </button>
          </InputGroupAddon>
        </InputGroup>
        <FieldError>{error}</FieldError>
      </Field>
      <p role="status" className="text-caption font-normal text-text-secondary">
        {notice
          ? 'Newsletter indisponível nesta demonstração.'
          : 'Receba lançamentos selecionados, histórias de criadores e novidades do mercado.'}
      </p>
    </form>
  )
}
