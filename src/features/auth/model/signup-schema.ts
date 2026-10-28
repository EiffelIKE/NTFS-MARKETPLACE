import { z } from 'zod'

import { SignupBody } from '@/contracts'

/** The sign-up schema: the API body plus a confirmation that must match (AUTH-01). */
export const SignupFormSchema = SignupBody.extend({
  confirmPassword: z.string().min(1, 'Confirme a senha.'),
}).refine((value) => value.password === value.confirmPassword, {
  path: ['confirmPassword'],
  message: 'As senhas não coincidem.',
})
