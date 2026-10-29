import { createFileRoute, notFound } from '@tanstack/react-router'
import { z } from 'zod'

import { EditionId, NftId } from '@/contracts'
import { nftDetailQuery, relatedQuery } from '@/features/catalog/api/queries'
import { DetailsError } from '@/features/nft-details/components/details-error'
import { DetailsPage } from '@/features/nft-details/components/details-page'
import { DetailsSkeleton } from '@/features/nft-details/components/details-skeleton'
import { NftNotFound } from '@/features/nft-details/components/nft-not-found'
import { isApiError } from '@/lib/http/errors'

const noop = () => undefined

// A value that is not an edition is dropped, but its key stays present as `undefined`: the router
// merges the raw URL params under the validated ones, and would bring `?edition=bogus` back
// (spec 05 design §15, item 13).
const detailsSearch = z.object({
  edition: z
    .unknown()
    .transform((value) => {
      const parsed = EditionId.safeParse(value)
      return parsed.success ? parsed.data : undefined
    })
    .optional(),
})

export const Route = createFileRoute('/nfts/$nftId')({
  validateSearch: detailsSearch,
  loader: async ({ context: { queryClient }, params: { nftId } }) => {
    // An id that cannot exist is a 404 without asking the API (DET-02).
    if (!NftId.safeParse(nftId).success) throw notFound()
    try {
      // `static` returns what is cached and fetches (with the query's own retries) only when
      // nothing is; the page's own observer keeps it fresh afterwards.
      const nft = await queryClient.query({ ...nftDetailQuery(nftId), staleTime: 'static' })
      // Not awaited: the related row has its own skeleton and failure state (DET-04).
      void queryClient.query(relatedQuery(nftId)).catch(noop)
      return { id: nft.id, name: nft.name }
    } catch (error) {
      if (isApiError(error, 'NOT_FOUND')) throw notFound()
      throw error
    }
  },
  pendingComponent: DetailsSkeleton,
  pendingMs: 150,
  pendingMinMs: 300,
  errorComponent: DetailsError,
  notFoundComponent: NftNotFound,
  staticData: {
    shell: {
      nav: 'market',
      headerDivider: false,
      mobile: { kind: 'inner', trailing: 'favorite', panel: true },
    },
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? [{ title: `${loaderData.name} · KURIO` }] : [],
  }),
  component: DetailsPage,
})
