import { NetworkList } from '@/contracts'

import { request, type ReadOptions } from './request'

export const networksApi = {
  list: (opts: ReadOptions = {}) =>
    request({
      id: 'networks.list',
      method: 'GET',
      url: '/networks',
      response: NetworkList,
      ...opts,
    }),
}
