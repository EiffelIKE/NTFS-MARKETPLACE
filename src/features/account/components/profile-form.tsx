import type { AnyFormApi } from '@tanstack/react-form'

import { notify } from '@/components/feedback'
import { useAppForm } from '@/components/form/app-form'
import { applyServerErrors, setFormError } from '@/components/form/server-errors'
import { submitForm } from '@/components/form/submit'
import { useFormFocus } from '@/components/form/use-form-focus'
import { formValidation } from '@/components/form/validation'
import { UpdateProfileBody, type Profile } from '@/contracts'
import { isApiError } from '@/lib/http/errors'

import { useChangePassword, useUpdateProfile } from '../api/profile-mutations'
import {
  passwordFilled,
  profileChanged,
  ProfileFormSchema,
  profileDefaults,
} from '../model/profile-form'
import { accountGrid, accountGroup, accountInput, accountSubmit } from './account-styles'
import { AvatarField } from './avatar-field'

const PROFILE_FIELDS = ['displayName', 'username', 'email', 'ensName', 'walletNickname'] as const
const PASSWORD_FIELDS = ['currentPassword', 'newPassword', 'confirmPassword'] as const

const PROFILE_SAVED = 'Perfil atualizado.'
const PASSWORD_SAVED = 'Senha alterada. As outras sessões foram encerradas.'

/**
 * The profile form (ACC-03 – ACC-06, ACC-10 – ACC-14; spec 08 design §4). One "Salvar" runs the
 * profile update and then, if the password section is filled, the password change: a failure of
 * the first stops there, and a failure of the second leaves the profile saved and reports only the
 * password. The password only travels in the request and is cleared once it succeeds.
 */
export function ProfileForm({ profile }: { profile: Profile }) {
  const updateProfile = useUpdateProfile()
  const changePassword = useChangePassword()
  const { formRef, focusFirstInvalid } = useFormFocus()

  const fail = (
    form: AnyFormApi,
    error: unknown,
    codes: Parameters<typeof applyServerErrors>[2] = {},
  ) => {
    if (applyServerErrors(form, error, codes)) {
      focusFirstInvalid()
      return
    }
    setFormError(form, isApiError(error) ? error.message : 'Algo deu errado. Tente novamente.')
  }

  const form = useAppForm({
    defaultValues: profileDefaults(profile),
    validationLogic: formValidation(),
    validators: { onDynamic: ProfileFormSchema },
    onSubmitInvalid: () => {
      focusFirstInvalid()
    },
    onSubmit: async ({ value, formApi }) => {
      const body = UpdateProfileBody.parse(value)
      const profileDirty = profileChanged(body, profile)
      const passwordDirty = passwordFilled(value)
      if (!profileDirty && !passwordDirty) {
        notify.info('Nenhuma alteração para salvar.')
        return
      }

      if (profileDirty) {
        try {
          const saved = await updateProfile.mutateAsync(body)
          // Show what the server kept (trimmed, e-mail lower-cased).
          const kept = profileDefaults(saved)
          for (const name of PROFILE_FIELDS) {
            if (formApi.getFieldValue(name) !== kept[name]) formApi.setFieldValue(name, kept[name])
          }
        } catch (error) {
          fail(formApi, error, { USERNAME_TAKEN: 'username', EMAIL_TAKEN: 'email' })
          return
        }
      }

      if (passwordDirty) {
        try {
          await changePassword.mutateAsync({
            currentPassword: value.currentPassword,
            newPassword: value.newPassword,
          })
        } catch (error) {
          // The profile part is saved; say so, and keep the error on the password section.
          if (profileDirty) notify.success(PROFILE_SAVED)
          fail(formApi, error)
          return
        }
        for (const name of PASSWORD_FIELDS) formApi.resetField(name)
      }

      notify.success(
        [profileDirty && PROFILE_SAVED, passwordDirty && PASSWORD_SAVED].filter(Boolean).join(' '),
      )
    },
  })

  return (
    <form
      ref={formRef}
      noValidate
      aria-label="Perfil do colecionador"
      className="flex flex-col gap-10"
      onSubmit={(event) => {
        event.preventDefault()
        event.stopPropagation()
        void submitForm(form)
      }}
    >
      <form.AppForm>
        <form.FormAlert />
      </form.AppForm>

      <div className={accountGrid}>
        <form.AppField name="displayName">
          {(field) => (
            <field.TextField
              label="Nome de exibição"
              required
              autoComplete="nickname"
              className={accountInput}
            />
          )}
        </form.AppField>

        <form.AppField name="username">
          {(field) => (
            <field.TextField
              label="Nome de usuário"
              required
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              description="Letras minúsculas, números e _."
              className={accountInput}
            />
          )}
        </form.AppField>

        <form.AppField name="email">
          {(field) => (
            <field.TextField
              label="E-mail"
              required
              type="email"
              inputMode="email"
              autoComplete="email"
              className={accountInput}
            />
          )}
        </form.AppField>

        <form.AppField name="ensName">
          {(field) => <field.EnsField required className={accountGroup} />}
        </form.AppField>

        <form.AppField name="walletNickname">
          {(field) => (
            <field.TextField label="Apelido da carteira" required className={accountInput} />
          )}
        </form.AppField>

        <AvatarField profile={profile} />
      </div>

      <section aria-labelledby="password-heading" className="flex flex-col gap-6">
        <h2 id="password-heading" className="text-body-lg font-bold text-foreground">
          Alterar senha
        </h2>
        <div className="flex flex-col gap-6 md:max-w-[calc(50%-0.875rem)]">
          <form.AppField name="currentPassword">
            {(field) => (
              <field.PasswordField
                label="Senha atual"
                autoComplete="current-password"
                className={accountGroup}
              />
            )}
          </form.AppField>
          <form.AppField name="newPassword">
            {(field) => (
              <field.PasswordField
                label="Nova senha"
                autoComplete="new-password"
                description="Use de 8 a 72 caracteres, com letras e números."
                className={accountGroup}
              />
            )}
          </form.AppField>
          <form.AppField name="confirmPassword">
            {(field) => (
              <field.PasswordField
                label="Confirmar nova senha"
                autoComplete="new-password"
                className={accountGroup}
              />
            )}
          </form.AppField>
        </div>
      </section>

      <form.AppForm>
        <form.SubmitButton className={accountSubmit}>Salvar</form.SubmitButton>
      </form.AppForm>
    </form>
  )
}
