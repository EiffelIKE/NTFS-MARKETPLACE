import type { QueryClient } from '@tanstack/react-query'

import type { FavoriteIds, NftId } from '@/contracts'

import { favoritesKeys } from './keys'

/** Sets one NFT's favorite state in the cached list. With no list yet, it starts one. */
export function setFavorite(
  queryClient: QueryClient,
  userId: string,
  nftId: NftId,
  favorite: boolean,
): void {
  queryClient.setQueryData<FavoriteIds>(favoritesKeys.list(userId), (old) => {
    const ids = old?.nftIds ?? []
    const without = ids.filter((id) => id !== nftId)
    return { nftIds: favorite ? [...without, nftId] : without }
  })
}

/**
 * What the user last asked for, per NFT, among the toggles that have not settled yet. The mutation
 * key is `['favorite', nftId]` and its variable is the requested state; the cache lists mutations
 * in creation order, so the last one of an NFT wins.
 */
export function pendingIntents(queryClient: QueryClient): Map<NftId, boolean> {
  const intents = new Map<NftId, boolean>()
  for (const mutation of queryClient.getMutationCache().getAll()) {
    const [scope, nftId] = mutation.options.mutationKey ?? []
    if (scope !== 'favorite' || typeof nftId !== 'string') continue
    if (mutation.state.status !== 'pending' || typeof mutation.state.variables !== 'boolean') {
      continue
    }
    intents.set(nftId, mutation.state.variables)
  }
  return intents
}

/** A list from the server with the toggles still on their way applied on top. */
export function withPendingIntents(queryClient: QueryClient, list: FavoriteIds): FavoriteIds {
  const intents = pendingIntents(queryClient)
  if (intents.size === 0) return list
  const nftIds = list.nftIds.filter((id) => intents.get(id) !== false)
  for (const [id, favorite] of intents) if (favorite && !nftIds.includes(id)) nftIds.push(id)
  return { nftIds }
}

/**
 * The state a click on the heart toggles: the last thing asked for while toggles are pending, else
 * the cached list. Reading it here and not from the rendered value is what lets two quick clicks
 * flip twice, even when React has not re-rendered between them or a read has just landed.
 */
export function currentFavorite(queryClient: QueryClient, userId: string, nftId: NftId): boolean {
  const intent = pendingIntents(queryClient).get(nftId)
  if (intent !== undefined) return intent
  return (
    queryClient.getQueryData<FavoriteIds>(favoritesKeys.list(userId))?.nftIds.includes(nftId) ??
    false
  )
}
