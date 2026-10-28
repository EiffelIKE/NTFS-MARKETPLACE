import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'

import { AlertCircleIcon } from '@/components/icons'
import { NftImage } from '@/components/nft-image'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

import { highlightsQuery } from '../api/queries'

/**
 * "NFT EM DESTAQUE / OFERTA LIMITADA", in the desktop sidebar (CAT-19). Hidden when the API has no
 * featured NFT; its own skeleton and its own retry. The whole banner links to the NFT.
 */
export function FeaturedBanner() {
  const { data, isPending, isError, refetch } = useQuery(highlightsQuery())

  if (isPending) return <Skeleton className="h-117.5 w-full" />
  if (isError) {
    // The hero shows the error message; the banner only offers its own retry.
    return (
      <Alert>
        <AlertCircleIcon />
        <AlertDescription>Não foi possível carregar o destaque.</AlertDescription>
        <Button
          variant="outline"
          size="sm"
          className="col-span-2 mt-2 w-fit"
          onClick={() => {
            void refetch()
          }}
        >
          Tentar novamente
        </Button>
      </Alert>
    )
  }
  const { featured } = data
  if (!featured) return null

  return (
    <Link
      to="/nfts/$nftId"
      params={{ nftId: featured.nftId }}
      className="group flex flex-col gap-4 bg-surface-card"
    >
      <span className="flex flex-col items-center gap-4 px-5 pt-5 text-center">
        <span className="text-heading text-text-accent">{featured.title}</span>
        <span className="text-body-lg leading-4 text-foreground">{featured.subtitle}</span>
      </span>
      <NftImage
        image={featured.image}
        slot="featured"
        className="aspect-[310/368] w-full rounded-md object-cover"
      />
    </Link>
  )
}
