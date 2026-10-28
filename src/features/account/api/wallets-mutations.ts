import {
  useMutation,
  useQueryClient,
  type MutationOptions,
  type QueryClient,
} from '@tanstack/react-query'

import { walletsApi } from '@/api'
import type { CreateWalletBody, Wallet, WalletFields, WalletList } from '@/contracts'
import { session as appSession } from '@/features/auth/model/instance'
import type { SessionController } from '@/features/auth/model/session'
import type { ApiError } from '@/lib/http/errors'

import { accountKeys } from './account-keys'

type Guard = Pick<SessionController, 'epoch' | 'isCurrent' | 'get'>

interface WriteContext {
  epoch: number
  userId: string | null
}

const ROLE_ORDER = { primary: 0, secondary: 1 } as const

/** The list with `wallet` replacing the one of its role (or added), primary first (ACC-20). */
export function withWallet(list: WalletList | undefined, wallet: Wallet): WalletList {
  const others = (list?.items ?? []).filter((item) => item.role !== wallet.role)
  return {
    items: [...others, wallet].sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]),
  }
}

export interface SaveWalletVariables {
  /** The id of the wallet being edited; absent when the slot is empty and the wallet is created. */
  walletId?: string | undefined
  role: Wallet['role']
  fields: WalletFields
}

/**
 * `wallets.create` or `wallets.update` (ACC-16, ACC-20). The saved wallet goes into the cached
 * list at once, then the list is refetched in the background, so checkout (spec 09) sees server
 * truth. A result that arrives after the session changed is dropped (spec 04 epoch guard).
 */
export function saveWalletOptions(
  queryClient: QueryClient,
  session: Guard = appSession,
): MutationOptions<Wallet, ApiError, SaveWalletVariables, WriteContext> {
  return {
    mutationKey: ['account', 'wallets', 'save'],
    mutationFn: ({ walletId, role, fields }) =>
      walletId === undefined
        ? walletsApi.create({ ...fields, role } satisfies CreateWalletBody)
        : walletsApi.update(walletId, fields),
    onMutate: () => {
      const state = session.get()
      return {
        epoch: session.epoch(),
        userId: state.status === 'authenticated' ? state.user.id : null,
      }
    },
    onSuccess: async (wallet, _variables, context) => {
      if (context.userId === null || !session.isCurrent(context.epoch)) return
      const key = accountKeys.wallets(context.userId)
      await queryClient.cancelQueries({ queryKey: key, exact: true })
      queryClient.setQueryData<WalletList>(key, (list) => withWallet(list, wallet))
      void queryClient.invalidateQueries({ queryKey: key, exact: true })
    },
  }
}

export function useSaveWallet() {
  const queryClient = useQueryClient()
  return useMutation(saveWalletOptions(queryClient))
}
