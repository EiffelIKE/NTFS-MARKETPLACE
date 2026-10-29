import { useQuery } from '@tanstack/react-query'

import { useSession } from '@/features/auth/model/use-session'

import { profileQueryOptions } from '../api/profile-queries'
import { walletsQueryOptions } from '../api/wallets-queries'

/** The signed-in user's id, or `undefined` while nobody is (a sign-out is leaving the screen). */
export function useAccountUserId(): string | undefined {
  const state = useSession()
  return state.status === 'authenticated' ? state.user.id : undefined
}

/** The profile of the signed-in user (ACC-03). */
export function useProfile() {
  const userId = useAccountUserId()
  return useQuery({ ...profileQueryOptions(userId ?? ''), enabled: userId !== undefined })
}

/** The wallets of the signed-in user (ACC-15). */
export function useWallets() {
  const userId = useAccountUserId()
  return useQuery({ ...walletsQueryOptions(userId ?? ''), enabled: userId !== undefined })
}
