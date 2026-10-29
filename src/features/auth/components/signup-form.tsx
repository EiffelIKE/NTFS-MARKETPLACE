import { useRouter } from '@tanstack/react-router'
import { notify } from '@/components/feedback'
import { useAppForm } from '@/components/form/app-form'
import { applyServerErrors, setFormError } from '@/components/form/server-errors'
import { submitForm } from '@/components/form/submit'
import { useFormFocus } from '@/components/form/use-form-focus'
import { formValidation } from '@/components/form/validation'
import { isApiError } from '@/lib/http/errors'

import { useSignup } from '../api/use-signup'
import type { AuthSearch } from '../model/auth-search'
import { SignupFormSchema } from '../model/signup-schema'
import { authInput, authPasswordGroup, authSubmit } from './auth-styles'

/** The sign-up form (AUTH-01, AUTH-02, AUTH-04 – AUTH-07, AUTH-12). */
export function SignupForm({ search }: { search: AuthSearch }) {
  const router = useRouter()
  const signup = useSignup()
  const { formRef, focusFirstInvalid } = useFormFocus()

  const form = useAppForm({
    defaultValues: { username: '', email: '', password: '', confirmPassword: '' },
    validationLogic: formValidation(),
    validators: { onDynamic: SignupFormSchema },
    onSubmitInvalid: () => {
      focusFirstInvalid()
    },
    onSubmit: async ({ value, formApi }) => {
      // Only what the API takes: the confirmation never leaves the form.
      const { username, email, password } = value
      try {
        const payload = await signup.mutateAsync({ username, email, password })
        notify.success(`Conta criada. Boas-vindas, ${payload.user.displayName}!`)
        await router.navigate({ href: search.redirect ?? '/', replace: true })
      } catch (error) {
        const mapped = applyServerErrors(formApi, error, {
          EMAIL_TAKEN: 'email',
          USERNAME_TAKEN: 'username',
        })
        if (mapped) {
          focusFirstInvalid()
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
      <form.AppForm>
        <form.FormAlert />
      </form.AppForm>

      <form.AppField name="username">
        {(field) => (
          <field.TextField
            label="Nome de usuário"
            hideLabel
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="Nome de usuário"
            className={authInput}
          />
        )}
      </form.AppField>

      <form.AppField name="email">
        {(field) => (
          <field.TextField
            label="E-mail"
            hideLabel
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="Digite seu e-mail"
            className={authInput}
          />
        )}
      </form.AppField>

      <form.AppField name="password">
        {(field) => (
          <field.PasswordField
            label="Senha"
            hideLabel
            autoComplete="new-password"
            placeholder="Senha"
            description="Use de 8 a 72 caracteres, com letras e números."
            className={authPasswordGroup}
          />
        )}
      </form.AppField>

      <form.AppField name="confirmPassword">
        {(field) => (
          <field.PasswordField
            label="Confirmar senha"
            hideLabel
            autoComplete="new-password"
            placeholder="Confirmar senha"
            className={authPasswordGroup}
          />
        )}
      </form.AppField>

      <form.AppForm>
        <form.SubmitButton className={authSubmit}>
          <span className="lg:hidden">Criar perfil</span>
          <span className="max-lg:hidden">Criar conta</span>
        </form.SubmitButton>
      </form.AppForm>
    </form>
  )
}
