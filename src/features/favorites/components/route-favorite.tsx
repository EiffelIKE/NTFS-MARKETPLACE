import { useMatches } from '@tanstack/react-router'

import { FavoriteButton } from './favorite-button'

/**
 * The details screen's heart in the mobile top bar, which the shell renders outside the route. It
 * reads the route's loader data (id and name) instead of subscribing to the NFT query: the shell
 * mounts while the loader is still fetching, and an observer that comes and goes (React strict
 * mode) would cancel that request. On a missing NFT there is no loader data, so nothing shows.
 */
export function RouteFavorite() {
  const nft = useMatches({
    select: (matches) => matches.find((match) => match.routeId === '/nfts/$nftId')?.loaderData,
  })
  if (!nft) return null
  return <FavoriteButton nft={nft} variant="circle" />
}
