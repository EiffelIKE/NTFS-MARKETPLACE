import { useQuery } from '@tanstack/react-query'

import type { NftId } from '@/contracts'
import { useSession } from '@/features/auth/model/use-session'

import { favoritesQuery } from '../api/queries'

/**
 * Whether the signed-in user favorited `nftId`. A guest has no list, so nothing is requested and
 * the answer is `false` (DET-22). Every heart on the page shares one request.
 */
export function useIsFavorite(nftId: NftId): boolean {
  const authenticated = useSession().status === 'authenticated'
  const { data } = useQuery({
    ...favoritesQuery(),
    enabled: authenticated,
    select: (response) => response.nftIds.includes(nftId),
  })
  return authenticated && data === true
}
