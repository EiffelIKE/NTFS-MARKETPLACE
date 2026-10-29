import { useRouter } from '@tanstack/react-router'

import { announce } from '@/components/feedback'
import { AlertCircleIcon } from '@/components/icons'
import { useAppForm } from '@/components/form/app-form'
import { setFormError } from '@/components/form/server-errors'
import { submitForm } from '@/components/form/submit'
import { useFormFocus } from '@/components/form/use-form-focus'
import { formValidation } from '@/components/form/validation'
import { Unavailable } from '@/components/layout/unavailable'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { LoginBody } from '@/contracts'
import { isApiError } from '@/lib/http/errors'

import { useLogin } from '../api/use-login'
import type { AuthSearch } from '../model/auth-search'
import { EXPIRED_MESSAGE, WRONG_CREDENTIALS_MESSAGE } from '../model/messages'
import { authInput, authPasswordGroup, authSubmit } from './auth-styles'

/** The login form (AUTH-03 – AUTH-07, AUTH-12, AUTH-14). */
export function LoginForm({ search }: { search: AuthSearch }) {
  const router = useRouter()
  const login = useLogin()
  const { formRef, focusFirstInvalid, focusField } = useFormFocus()

  const form = useAppForm({
    defaultValues: { email: '', password: '' },
    validationLogic: formValidation(),
    validators: { onDynamic: LoginBody },
    onSubmitInvalid: () => {
      focusFirstInvalid()
    },
    onSubmit: async ({ value, formApi }) => {
      try {
        const payload = await login.mutateAsync(value)
        announce(`Você entrou como ${payload.user.displayName}.`)
        // Back leaves the login page behind, and the redirect keeps the original search and hash.
        await router.navigate({ href: search.redirect ?? '/', replace: true })
      } catch (error) {
        if (isApiError(error, 'INVALID_CREDENTIALS')) {
          // Neither field is wrong on its own; the password is cleared and re-focused.
          formApi.setFieldValue('password', '', { dontValidate: true })
          setFormError(formApi, WRONG_CREDENTIALS_MESSAGE)
          focusField('password')
          return
        }
        setFormError(
          formApi,
          isApiError(error) ? error.message : 'Algo deu errado. Tente novamente.',
        )
      }
    },
  })

  return (
    <form
      ref={formRef}
      noValidate
      className="flex flex-col gap-4 lg:gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        event.stopPropagation()
        void submitForm(form)
      }}
    >
      {search.reason === 'expired' && (
        <Alert variant="info">
          <AlertCircleIcon />
          <AlertDescription>{EXPIRED_MESSAGE}</AlertDescription>
        </Alert>
      )}

      <form.AppForm>
        <form.FormAlert />
      </form.AppForm>

      <form.AppField name="email">
        {(field) => (
          <field.TextField
            label="E-mail"
            hideLabel
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="contato@email.com"
            className={authInput}
          />
        )}
      </form.AppField>

      <div className="flex flex-col gap-2">
        <form.AppField name="password">
          {(field) => (
            <field.PasswordField
              label="Senha"
              hideLabel
              autoComplete="current-password"
              placeholder="Digite sua senha"
              className={authPasswordGroup}
            />
          )}
        </form.AppField>
        <Unavailable className="self-end text-caption font-normal text-text-accent">
          Esqueceu a senha?
        </Unavailable>
      </div>

      <form.AppForm>
        <form.SubmitButton className={authSubmit}>Entrar</form.SubmitButton>
      </form.AppForm>
    </form>
  )
}
