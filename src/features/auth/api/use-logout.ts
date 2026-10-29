import { useCallback } from 'react'

import { authApi } from '@/api'
import { notify } from '@/components/feedback'

import { session } from '../model/instance'

/**
 * "Sair" (AUTH-16): tell the API, then sign out locally whatever it answered. The bridge clears
 * the private data and leaves a protected route.
 */
export function useLogout() {
  return useCallback(async () => {
    try {
      await authApi.logout()
    } catch {
      // The server may be unreachable or the token already dead; the user still leaves.
    }
    session.signOut('logout')
    notify.info('Você saiu da sua conta.')
  }, [])
}
