import { z } from 'zod'

import { Email, IsoDateTime, Username } from './common'

/** 8–72 characters with at least one letter and one digit (spec 02 §4). */
export const Password = z
  .string({ error: 'Informe uma senha.' })
  .min(1, 'Informe uma senha.')
  .min(8, 'Use pelo menos 8 caracteres.')
  .max(72, 'Use no máximo 72 caracteres.')
  .regex(/[A-Za-z]/, 'A senha precisa ter pelo menos uma letra.')
  .regex(/\d/, 'A senha precisa ter pelo menos um número.')

export const SignupBody = z.object({ username: Username, email: Email, password: Password })
export type SignupBody = z.infer<typeof SignupBody>

export const LoginBody = z.object({
  email: Email,
  password: z.string({ error: 'Informe sua senha.' }).min(1, 'Informe sua senha.'),
})
export type LoginBody = z.infer<typeof LoginBody>

export const User = z.object({
  id: z.string(),
  username: z.string(),
  displayName: z.string(),
  email: z.string(),
  avatarUrl: z.string().nullable(),
})
export type User = z.infer<typeof User>

export const SessionInfo = z.object({ expiresAt: IsoDateTime, user: User })
export type SessionInfo = z.infer<typeof SessionInfo>

export const SessionPayload = SessionInfo.extend({ token: z.string() })
export type SessionPayload = z.infer<typeof SessionPayload>
