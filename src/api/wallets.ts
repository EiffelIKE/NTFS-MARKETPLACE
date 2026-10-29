import { z } from 'zod'

import {
  Wallet,
  WalletConnection,
  WalletConnectionList,
  WalletList,
  type ConnectWalletBody,
  type CreateWalletBody,
  type WalletFields,
} from '@/contracts'

import { path, request, type ReadOptions } from './request'

export const walletsApi = {
  list: (opts: ReadOptions = {}) =>
    request({ id: 'wallets.list', method: 'GET', url: '/wallets', response: WalletList, ...opts }),
  create: (body: CreateWalletBody) =>
    request({
      id: 'wallets.create',
      method: 'POST',
      url: '/wallets',
      data: body,
      response: Wallet,
    }),
  update: (walletId: string, body: WalletFields) =>
    request({
      id: 'wallets.update',
      method: 'PUT',
      url: `/wallets/${path(walletId)}`,
      data: body,
      response: Wallet,
    }),
  connections: (opts: ReadOptions = {}) =>
    request({
      id: 'walletConnections.list',
      method: 'GET',
      url: '/wallet-connections',
      response: WalletConnectionList,
      ...opts,
    }),
  connect: (body: ConnectWalletBody) =>
    request({
      id: 'walletConnections.connect',
      method: 'POST',
      url: '/wallet-connections',
      data: body,
      response: WalletConnection,
    }),
  disconnect: (connectionId: string) =>
    request({
      id: 'walletConnections.disconnect',
      method: 'DELETE',
      url: `/wallet-connections/${path(connectionId)}`,
      response: z.undefined(),
    }),
}
