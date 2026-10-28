import {
  MutationObserver,
  useMutation,
  useQueryClient,
  type MutationOptions,
  type QueryClient,
} from '@tanstack/react-query'

import { favoritesApi } from '@/api'
import { notify } from '@/components/feedback'
import type { NftId, NftListQuery } from '@/contracts'
import { session as appSession } from '@/features/auth/model/instance'
import type { SessionController } from '@/features/auth/model/session'
import { catalogKeys } from '@/features/catalog/api/keys'
import { isSessionError } from '@/lib/http/auth'
import type { ApiError } from '@/lib/http/errors'

import { setFavorite } from './favorites-cache'
import { favoritesKeys } from './keys'

type Guard = Pick<SessionController, 'epoch' | 'isCurrent'>

interface ToggleContext {
  epoch: number
}

export const FAVORITE_ERROR = 'Não foi possível atualizar seus favoritos.'

const noop = () => undefined

/** A cached list that depends on the favorites (`/?favorites=1`). */
const isFavoritesList = (queryKey: readonly unknown[]) =>
  (queryKey[2] as NftListQuery | undefined)?.favorites === true

/**
 * The optimistic favorite toggle (DET-20, DET-21; brief §4). The variable is the state the user
 * asked for, so retrying and replaying are idempotent (`PUT` / `DELETE`).
 *
 * - `onMutate` flips the cache at once.
 * - The mutation `scope` is the NFT, so quick toggles of one NFT reach the server in click order
 *   and it ends in the last one's state.
 * - A failure undoes only its own intent instead of restoring a snapshot, so toggles queued after
 *   it keep their state, and the final refetch (below) shows the server's truth.
 * - The last settled toggle of an NFT reconciles the list and the favorites-only catalog lists.
 * - A result that arrives after the session changed is dropped (spec 04 epoch guard): the cache
 *   it would touch belongs to someone else by then.
 *
 * An options factory, so the logic runs under a plain `MutationObserver` in tests.
 */
export function favoriteMutationOptions(
  queryClient: QueryClient,
  nftId: NftId,
  session: Guard = appSession,
): MutationOptions<void, ApiError, boolean, ToggleContext> {
  const options: MutationOptions<void, ApiError, boolean, ToggleContext> = {
    mutationKey: ['favorite', nftId],
    scope: { id: `favorite:${nftId}` },
    mutationFn: (next) => (next ? favoritesApi.add(nftId) : favoritesApi.remove(nftId)),
    onMutate: async (next) => {
      const epoch = session.epoch()
      await queryClient.cancelQueries({ queryKey: favoritesKeys.all })
      setFavorite(queryClient, nftId, next)
      return { epoch }
    },
    onError: (error, next, context) => {
      if (!context || !session.isCurrent(context.epoch)) return
      setFavorite(queryClient, nftId, !next)
      // An expired session has its own flow (spec 04); a toast about favorites would be noise.
      if (isSessionError(error)) return
      notify.error(FAVORITE_ERROR, {
        action: {
          label: 'Tentar novamente',
          onClick: () => {
            // The component may be gone by now; the mutation does not need it.
            void new MutationObserver(queryClient, options).mutate(next).catch(noop)
          },
        },
      })
    },
    onSettled: (_data, _error, _next, context) => {
      if (!context || !session.isCurrent(context.epoch)) return
      // This mutation is still counted as pending here, so "1" means it is the last one.
      if (queryClient.isMutating({ mutationKey: ['favorite', nftId] }) > 1) return
      void queryClient.invalidateQueries({ queryKey: favoritesKeys.all })
      void queryClient.invalidateQueries({
        queryKey: catalogKeys.lists(),
        predicate: (query) => isFavoritesList(query.queryKey),
      })
    },
  }
  return options
}

export function useToggleFavorite(nftId: NftId) {
  const queryClient = useQueryClient()
  return useMutation(favoriteMutationOptions(queryClient, nftId))
}
