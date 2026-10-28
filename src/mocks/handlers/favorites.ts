import type { OperationId } from '@/contracts'

import { HttpError } from '../lib/http-error'
import { noContent, ok, op, type AnyOp } from './pipeline'

export const favoriteOps = {
  'favorites.list': op({
    handle: ({ runtime, user }) =>
      ok({ nftIds: runtime.store.read((state) => state.favorites[user().id] ?? []) }),
  }),

  /** Idempotent: adding twice is the same as once. */
  'favorites.add': op({
    handle({ runtime, params, user }) {
      const { id } = user()
      const nftId = params.nftId ?? ''
      runtime.store.write((tx) => {
        if (!tx.state.nfts[nftId])
          throw new HttpError('NOT_FOUND', { details: { resource: 'nft' } })
        const mine = (tx.state.favorites[id] ??= [])
        if (!mine.includes(nftId)) mine.push(nftId)
      })
      return noContent()
    },
  }),

  /** Idempotent: removing something that is not there still succeeds. */
  'favorites.remove': op({
    handle({ runtime, params, user }) {
      const { id } = user()
      const nftId = params.nftId ?? ''
      runtime.store.write((tx) => {
        const mine = tx.state.favorites[id]
        if (mine) tx.state.favorites[id] = mine.filter((existing) => existing !== nftId)
      })
      return noContent()
    },
  }),
} satisfies Partial<Record<OperationId, AnyOp>>
