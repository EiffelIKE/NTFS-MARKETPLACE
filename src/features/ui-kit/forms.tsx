import { useState } from 'react'
import { z } from 'zod'

import { useAppForm } from '@/components/form/app-form'
import { submitForm } from '@/components/form/submit'
import { formValidation } from '@/components/form/validation'

import { Section } from './section'

const Schema = z.object({
  name: z.string().min(3, 'Use pelo menos 3 caracteres.'),
  password: z.string().min(8, 'Use pelo menos 8 caracteres.'),
})

/** The shared form layer (spec 04 §8): errors on blur, then on every change once a submit failed. */
export function FormLayerSection() {
  const [sent, setSent] = useState(false)
  const form = useAppForm({
    defaultValues: { name: '', password: '' },
    validationLogic: formValidation(),
    validators: { onDynamic: Schema },
    onSubmit: () => {
      setSent(true)
    },
  })

  return (
    <Section id="formularios" title="Formulários" className="flex-col items-start">
      <form
        aria-label="Exemplo de formulário"
        noValidate
        className="flex w-72 flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          setSent(false)
          void submitForm(form)
        }}
      >
        <form.AppField name="name">
          {(field) => <field.TextField label="Nome" autoComplete="off" />}
        </form.AppField>
        <form.AppField name="password">
          {(field) => (
            <field.PasswordField
              label="Senha de exemplo"
              autoComplete="off"
              description="Mínimo de 8 caracteres."
            />
          )}
        </form.AppField>
        <form.AppForm>
          <form.SubmitButton>Enviar exemplo</form.SubmitButton>
        </form.AppForm>
      </form>
      <p role="status" className="text-body text-text-secondary">
        {sent ? 'Exemplo enviado: nada sai do navegador.' : ''}
      </p>
    </Section>
  )
}
