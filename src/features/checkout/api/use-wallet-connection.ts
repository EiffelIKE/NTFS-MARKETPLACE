import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'

import { walletsApi } from '@/api'
import { announce } from '@/components/feedback'
import {
  WALLET_PROVIDER_LABELS,
  type NetworkId,
  type WalletConnection,
  type WalletConnectionList,
  type WalletProvider,
} from '@/contracts'
import { useAccountUserId } from '@/features/account/model/use-account'
import { session } from '@/features/auth/model/instance'
import { isSessionError } from '@/lib/http/auth'

import { checkoutKeys, connectionsQueryOptions } from './checkout-queries'

/** The combination a connection is for: a change in any of the three needs a new one (CHK-17). */
export interface ConnectionTarget {
  walletId: string
  provider: WalletProvider
  network: NetworkId
}

/** `isSessionError` as a plain boolean, so a failed check does not narrow the error away. */
const sessionLost = (error: unknown): boolean => isSessionError(error)

export const matchesTarget = (connection: WalletConnection, target: ConnectionTarget) =>
  connection.status === 'connected' &&
  connection.walletId === target.walletId &&
  connection.provider === target.provider &&
  connection.network === target.network

/** Marks the wallet's connected connections as disconnected in the cache, as the server does. */
export function markDisconnected(queryClient: QueryClient, userId: string, walletId: string) {
  const key = checkoutKeys.connections(userId)
  const now = new Date().toISOString()
  queryClient.setQueryData<WalletConnectionList>(key, (list) =>
    list
      ? {
          items: list.items.map((connection) =>
            connection.walletId === walletId && connection.status === 'connected'
              ? { ...connection, status: 'disconnected', disconnectedAt: now }
              : connection,
          ),
        }
      : list,
  )
  void queryClient.invalidateQueries({ queryKey: key })
}

/**
 * The simulated wallet connection for the chosen wallet, provider and network (CHK-14 – CHK-17).
 * "Connected" is derived from the connections list, so changing any of the three makes the old
 * connection not apply without any reset code. A result that lands after the session changed is
 * dropped (spec 04 epoch guard).
 */
export function useWalletConnection(target: ConnectionTarget) {
  const queryClient = useQueryClient()
  const userId = useAccountUserId()
  const list = useQuery({
    ...connectionsQueryOptions(userId ?? ''),
    enabled: userId !== undefined,
  })
  const connection = list.data?.items.find((candidate) => matchesTarget(candidate, target))
  const providerName = WALLET_PROVIDER_LABELS[target.provider]

  const connect = useMutation({
    mutationKey: ['wallet-connections', 'connect'],
    mutationFn: () => walletsApi.connect(target),
    onMutate: () => ({ epoch: session.epoch() }),
    onSuccess: (created, _variables, context) => {
      if (userId === undefined || !session.isCurrent(context.epoch)) return
      queryClient.setQueryData<WalletConnectionList>(
        checkoutKeys.connections(userId),
        (current) => ({
          items: [
            ...(current?.items ?? []).map((candidate) =>
              candidate.walletId === created.walletId && candidate.status === 'connected'
                ? { ...candidate, status: 'disconnected' as const }
                : candidate,
            ),
            created,
          ],
        }),
      )
      announce(`Carteira ${providerName} conectada.`)
    },
  })

  const disconnect = useMutation({
    mutationKey: ['wallet-connections', 'disconnect'],
    mutationFn: (connectionId: string) => walletsApi.disconnect(connectionId),
    onMutate: () => ({ epoch: session.epoch() }),
    onSuccess: (_result, _connectionId, context) => {
      if (userId === undefined || !session.isCurrent(context.epoch)) return
      markDisconnected(queryClient, userId, target.walletId)
      announce('Carteira desconectada.')
    },
  })

  return {
    /** The connected connection for this exact combination, if any. */
    connection,
    connected: connection !== undefined,
    /** The list failed or has not loaded: connecting still works, the state is just unknown. */
    listReady: list.isSuccess,
    refresh: () => list.refetch(),
    connect,
    disconnect,
    /** A refusal that is not a lost session (that one has its own flow). */
    connectError: connect.error && !sessionLost(connect.error) ? connect.error : null,
  }
}
