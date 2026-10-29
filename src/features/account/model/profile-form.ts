import { z } from 'zod'

import { Password, UpdateProfileBody, type Profile } from '@/contracts'

/**
 * The profile form (spec 08 design §4): the `UpdateProfileBody` fields plus the optional password
 * section, flat so API `fields` map onto inputs by name. The section is skipped while its three
 * fields are empty (ACC-10); when any is filled all three are required.
 */
export const ProfileFormSchema = UpdateProfileBody.extend({
  currentPassword: z.string(),
  newPassword: z.string(),
  confirmPassword: z.string(),
}).superRefine((values, ctx) => {
  if (!passwordFilled(values)) return
  const add = (path: string, message: string) => {
    ctx.addIssue({ code: 'custom', path: [path], message })
  }

  if (!values.currentPassword) add('currentPassword', 'Informe a senha atual.')

  if (!values.newPassword) {
    add('newPassword', 'Informe a nova senha.')
  } else {
    const policy = Password.safeParse(values.newPassword)
    if (!policy.success) {
      add('newPassword', policy.error.issues[0]?.message ?? 'Senha inválida.')
    } else if (values.newPassword === values.currentPassword) {
      add('newPassword', 'A nova senha deve ser diferente da atual.')
    }
  }

  if (!values.confirmPassword) add('confirmPassword', 'Confirme a nova senha.')
  else if (values.confirmPassword !== values.newPassword) {
    add('confirmPassword', 'As senhas não coincidem.')
  }
})

export type ProfileFormValues = z.input<typeof ProfileFormSchema>

type PasswordValues = Pick<ProfileFormValues, 'currentPassword' | 'newPassword' | 'confirmPassword'>

/** Whether the user touched the password section. Passwords are never trimmed. */
export function passwordFilled(values: PasswordValues): boolean {
  return Boolean(values.currentPassword || values.newPassword || values.confirmPassword)
}

/** The form's start (and the values a save leaves): the saved profile, nothing in the section. */
export function profileDefaults(profile: Profile): ProfileFormValues {
  return {
    displayName: profile.displayName,
    username: profile.username,
    email: profile.email,
    ensName: profile.ensName ?? '',
    walletNickname: profile.walletNickname ?? '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  }
}

/** Whether a valid body differs from the saved profile, so an untouched form sends nothing. */
export function profileChanged(body: UpdateProfileBody, profile: Profile): boolean {
  return (
    body.displayName !== profile.displayName ||
    body.username !== profile.username ||
    body.email.toLowerCase() !== profile.email.toLowerCase() ||
    body.ensName !== (profile.ensName ?? '') ||
    body.walletNickname !== (profile.walletNickname ?? '')
  )
}
