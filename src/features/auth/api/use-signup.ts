import { useMutation } from '@tanstack/react-query'

import { authApi } from '@/api'
import type { SignupBody } from '@/contracts'

import { session } from '../model/instance'

/** Sign-up signs the new user in right away (AUTH-07, US-1). */
export function useSignup() {
  return useMutation({
    mutationFn: async (body: SignupBody) => {
      const payload = await authApi.signup(body)
      await session.signIn(payload, 'signup')
      return payload
    },
  })
}
