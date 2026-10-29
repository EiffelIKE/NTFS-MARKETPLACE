import { queryOptions } from '@tanstack/react-query'

import { walletsApi } from '@/api'

import { accountKeys } from './account-keys'

/** The user's wallets, primary first. Checkout (spec 09) reads the same entry. */
export const walletsQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: accountKeys.wallets(userId),
    queryFn: ({ signal }) => walletsApi.list({ signal }),
    staleTime: 60_000,
  })
