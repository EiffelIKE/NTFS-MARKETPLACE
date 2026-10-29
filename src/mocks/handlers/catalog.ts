import { NftListWireQuery, type OperationId } from '@/contracts'

import { queryCatalog, relatedTo } from '../domain/catalog-query'
import { toHighlights, toNftDetail, toNftSummary } from '../domain/mappers'
import { HttpError } from '../lib/http-error'
import { ok, op, type AnyOp } from './pipeline'

const notFound = () => new HttpError('NOT_FOUND', { details: { resource: 'nft' } })

export const catalogOps = {
  'nfts.list': op({
    query: NftListWireQuery,
    handle({ runtime, query, session }) {
      if (query.favorites && !session) throw new HttpError('UNAUTHENTICATED')
      return ok(
        runtime.store.read((state) => {
          const favorites = session ? new Set(state.favorites[session.user.id] ?? []) : null
          return queryCatalog(Object.values(state.nfts), query, favorites)
        }),
      )
    },
  }),

  'nfts.get': op({
    handle({ runtime, params }) {
      const nft = runtime.store.read((state) => state.nfts[params.nftId ?? ''])
      if (!nft) throw notFound()
      return ok(toNftDetail(nft))
    },
  }),

  'nfts.related': op({
    handle({ runtime, params }) {
      return ok(
        runtime.store.read((state) => {
          const nft = state.nfts[params.nftId ?? '']
          if (!nft) throw notFound()
          return { items: relatedTo(nft, Object.values(state.nfts)).map(toNftSummary) }
        }),
      )
    },
  }),

  'highlights.get': op({
    handle: ({ runtime }) => ok(runtime.store.read((state) => toHighlights(state.highlights))),
  }),
} satisfies Partial<Record<OperationId, AnyOp>>
