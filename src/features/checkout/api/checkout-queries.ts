import { queryOptions } from '@tanstack/react-query'

import { networksApi, walletsApi } from '@/api'

/** Keys of the data only checkout reads. The user is in the key, as in specs 07 and 08. */
export const checkoutKeys = {
  networks: ['networks'] as const,
  connections: (userId: string) => ['wallet-connections', userId] as const,
}

/** Network names and fees: a static fixture, so it never goes stale. */
export const networksQueryOptions = () =>
  queryOptions({
    queryKey: checkoutKeys.networks,
    queryFn: ({ signal }) => networksApi.list({ signal }),
    staleTime: Infinity,
  })

/** The simulated connections of the user's wallets (CHK-14 – CHK-17). */
export const connectionsQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: checkoutKeys.connections(userId),
    queryFn: ({ signal }) => walletsApi.connections({ signal }),
    staleTime: 0,
  })
