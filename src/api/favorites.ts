import { z } from 'zod'

import { FavoriteIds } from '@/contracts'

import { path, request, type ReadOptions } from './request'

export const favoritesApi = {
  list: (opts: ReadOptions = {}) =>
    request({
      id: 'favorites.list',
      method: 'GET',
      url: '/favorites',
      response: FavoriteIds,
      ...opts,
    }),
  add: (nftId: string) =>
    request({
      id: 'favorites.add',
      method: 'PUT',
      url: `/favorites/${path(nftId)}`,
      response: z.undefined(),
    }),
  remove: (nftId: string) =>
    request({
      id: 'favorites.remove',
      method: 'DELETE',
      url: `/favorites/${path(nftId)}`,
      response: z.undefined(),
    }),
}
