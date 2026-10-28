import { z } from 'zod'

import { Password } from './auth'
import { Email, EnsLabel, IsoDateTime, Username, text } from './common'

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024
export const AVATAR_ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const
export const AVATAR_TYPE_MESSAGE = 'Envie uma imagem PNG, JPEG ou WebP.'
export const AVATAR_SIZE_MESSAGE = 'A imagem deve ter no máximo 2 MB.'

export const Profile = z.object({
  id: z.string(),
  displayName: z.string(),
  username: z.string(),
  email: z.string(),
  /** Stored without the `.eth` suffix; `null` until the first save. */
  ensName: z.string().nullable(),
  walletNickname: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  createdAt: IsoDateTime,
})
export type Profile = z.infer<typeof Profile>

/** A full replace: every Figma field is required. */
export const UpdateProfileBody = z.object({
  displayName: text(2, 40),
  username: Username,
  email: Email,
  ensName: EnsLabel,
  walletNickname: text(1, 32),
})
export type UpdateProfileBody = z.infer<typeof UpdateProfileBody>

export const ChangePasswordBody = z
  .object({
    currentPassword: z.string({ error: 'Informe a senha atual.' }).min(1, 'Informe a senha atual.'),
    newPassword: Password,
  })
  .refine((body) => body.currentPassword !== body.newPassword, {
    error: 'A nova senha deve ser diferente da atual.',
    path: ['newPassword'],
  })
export type ChangePasswordBody = z.infer<typeof ChangePasswordBody>
