import { ExplorerTransaction, type NetworkId } from '@/contracts'

import { path, request, type ReadOptions } from './request'

export const explorerApi = {
  /** Public: no session involved. An unknown hash, or one on another network, is a 404. */
  getTransaction: (network: NetworkId, txHash: string, opts: ReadOptions = {}) =>
    request({
      id: 'explorer.getTransaction',
      method: 'GET',
      url: `/explorer/${path(network)}/tx/${path(txHash)}`,
      response: ExplorerTransaction,
      ...opts,
    }),
}
