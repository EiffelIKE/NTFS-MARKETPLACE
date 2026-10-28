import type { QueryClient } from '@tanstack/react-query'

import type { FavoriteIds, NftId } from '@/contracts'

import { favoritesKeys } from './keys'

/** Sets one NFT's favorite state in the cached list. With no list yet, it starts one. */
export function setFavorite(queryClient: QueryClient, nftId: NftId, favorite: boolean): void {
  queryClient.setQueryData<FavoriteIds>(favoritesKeys.all, (old) => {
    const ids = old?.nftIds ?? []
    const without = ids.filter((id) => id !== nftId)
    return { nftIds: favorite ? [...without, nftId] : without }
  })
}
