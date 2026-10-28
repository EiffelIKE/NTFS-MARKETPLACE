import { useQuery } from '@tanstack/react-query'

import type { NftId } from '@/contracts'
import { useSession } from '@/features/auth/model/use-session'

import { favoritesQuery } from '../api/queries'

export interface FavoriteState {
  /** Whether the signed-in user favorited the NFT. A guest never has favorites (DET-22). */
  pressed: boolean
  /**
   * Whether `pressed` can be trusted. A signed-in user's list may not have arrived yet (fresh
   * load) or may have failed; until it is known a click would ask for "add" even for an NFT that
   * is already a favorite, so the control must not act (spec 11 audit, A11Y-10).
   */
  known: boolean
  /** The list is on its way, which is what `aria-busy` reports. */
  loading: boolean
  /** Asks for the list again (the control's click while the first read failed). */
  retry: () => void
}

/**
 * The signed-in user's favorite state for `nftId`. A guest has no list, so nothing is requested
 * and the state is known and `false`. Every heart on the page shares one request.
 */
export function useFavoriteState(nftId: NftId): FavoriteState {
  const authenticated = useSession().status === 'authenticated'
  const { data, isFetching, refetch } = useQuery({
    ...favoritesQuery(),
    enabled: authenticated,
    select: (response) => response.nftIds.includes(nftId),
  })
  return {
    pressed: authenticated && data === true,
    known: !authenticated || data !== undefined,
    loading: authenticated && data === undefined && isFetching,
    retry: () => void refetch(),
  }
}
