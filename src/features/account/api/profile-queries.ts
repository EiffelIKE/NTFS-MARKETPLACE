import { queryOptions } from '@tanstack/react-query'

import { profileApi } from '@/api'

import { accountKeys } from './account-keys'

export const profileQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: accountKeys.profile(userId),
    queryFn: ({ signal }) => profileApi.get({ signal }),
    staleTime: 60_000,
  })
