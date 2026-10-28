import {
  Highlights,
  NftDetail,
  NftListResponse,
  RelatedResponse,
  toWireQuery,
  type NftListQueryInput,
} from '@/contracts'

import { path, request, type ReadOptions } from './request'

export const catalogApi = {
  list: (query: NftListQueryInput = {}, opts: ReadOptions = {}) =>
    request({
      id: 'nfts.list',
      method: 'GET',
      url: '/nfts',
      params: toWireQuery(query),
      response: NftListResponse,
      ...opts,
    }),
  get: (nftId: string, opts: ReadOptions = {}) =>
    request({
      id: 'nfts.get',
      method: 'GET',
      url: `/nfts/${path(nftId)}`,
      response: NftDetail,
      ...opts,
    }),
  related: (nftId: string, opts: ReadOptions = {}) =>
    request({
      id: 'nfts.related',
      method: 'GET',
      url: `/nfts/${path(nftId)}/related`,
      response: RelatedResponse,
      ...opts,
    }),
  highlights: (opts: ReadOptions = {}) =>
    request({
      id: 'highlights.get',
      method: 'GET',
      url: '/highlights',
      response: Highlights,
      ...opts,
    }),
}
