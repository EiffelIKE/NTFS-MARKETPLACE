import { useMutation } from '@tanstack/react-query'

import { authApi } from '@/api'
import type { LoginBody } from '@/contracts'

import { session } from '../model/instance'

/**
 * Login (AUTH-07). The session is set inside the mutation, so its pending state also covers the
 * post-sign-in tasks (spec 07's cart merge) and the form only navigates once they are done.
 */
export function useLogin() {
  return useMutation({
    mutationFn: async (body: LoginBody) => {
      const payload = await authApi.login(body)
      await session.signIn(payload, 'login')
      return payload
    },
  })
}
