import {
  addressFamily,
  addressMatchesNetwork,
  networkFamily,
  type CreateWalletBody,
  type NetworkId,
  type WalletFields,
  type WalletProvider,
} from '@/contracts'

import type { ConnectionRecord, MockState, WalletRecord } from '../db/state'
import type { Tx } from '../db/store'
import { HttpError, fieldError } from '../lib/http-error'

export { addressMatchesNetwork }

/** EVM addresses compare case-insensitively, Solana's exactly. */
function sameAddress(a: string, b: string): boolean {
  return addressFamily(a) === 'evm' ? a.toLowerCase() === b.toLowerCase() : a === b
}

export function userWallets(state: Readonly<MockState>, userId: string): WalletRecord[] {
  return Object.values(state.wallets).filter((wallet) => wallet.userId === userId)
}

function assertDuplicate(wallets: WalletRecord[], address: string, exceptId?: string): void {
  if (wallets.some((wallet) => wallet.id !== exceptId && sameAddress(wallet.address, address))) {
    throw new HttpError('WALLET_DUPLICATE', {
      fields: { address: ['Este endereço já está em outra carteira sua.'] },
    })
  }
}

export function createWallet(tx: Tx, userId: string, body: CreateWalletBody): WalletRecord {
  const mine = userWallets(tx.state, userId)
  if (mine.some((wallet) => wallet.role === body.role)) {
    throw new HttpError('WALLET_ROLE_TAKEN', {
      fields: { role: ['Você já tem uma carteira neste papel.'] },
    })
  }
  assertDuplicate(mine, body.address)
  const now = new Date(tx.now).toISOString()
  const id = `wal_${String(++tx.state.seq.wallet).padStart(6, '0')}`
  const family = addressFamily(body.address)
  if (!family) throw fieldError('address', 'Endereço de carteira inválido.')
  const wallet: WalletRecord = { ...body, id, userId, family, createdAt: now, updatedAt: now }
  tx.state.wallets[id] = wallet
  return wallet
}

/** A wallet of someone else is 403, an unknown id 404. */
export function ownedWallet(
  state: Readonly<MockState>,
  userId: string,
  walletId: string,
): WalletRecord {
  const wallet = state.wallets[walletId]
  if (!wallet) throw new HttpError('NOT_FOUND', { details: { resource: 'wallet' } })
  if (wallet.userId !== userId) throw new HttpError('FORBIDDEN')
  return wallet
}

export function updateWallet(
  tx: Tx,
  userId: string,
  walletId: string,
  body: WalletFields,
): WalletRecord {
  const wallet = ownedWallet(tx.state, userId, walletId)
  assertDuplicate(userWallets(tx.state, userId), body.address, walletId)
  const family = addressFamily(body.address)
  if (!family) throw fieldError('address', 'Endereço de carteira inválido.')
  const { alternateWallet, ...rest } = body
  // `alternateWallet` is optional: leaving it out clears it.
  const next: WalletRecord = {
    ...wallet,
    ...rest,
    family,
    updatedAt: new Date(tx.now).toISOString(),
  }
  if (alternateWallet === undefined) delete next.alternateWallet
  else next.alternateWallet = alternateWallet
  tx.state.wallets[walletId] = next
  return next
}

export function isConnected(
  state: Readonly<MockState>,
  userId: string,
  walletId: string,
  provider: WalletProvider,
  network: NetworkId,
): boolean {
  return Object.values(state.connections).some(
    (c) =>
      c.userId === userId &&
      c.walletId === walletId &&
      c.provider === provider &&
      c.network === network &&
      c.status === 'connected',
  )
}

/** Validates the wallet and network before the (delayed) connection is attempted. */
export function assertConnectable(
  state: Readonly<MockState>,
  userId: string,
  walletId: string,
  network: NetworkId,
): WalletRecord {
  const wallet = ownedWallet(state, userId, walletId)
  if (networkFamily(network) !== wallet.family) {
    throw fieldError('network', 'Esta carteira não suporta a rede selecionada.')
  }
  return wallet
}

/** Creates the connection and closes any previous connection of the same wallet. */
export function connectWallet(
  tx: Tx,
  userId: string,
  walletId: string,
  provider: WalletProvider,
  network: NetworkId,
): ConnectionRecord {
  const now = new Date(tx.now).toISOString()
  for (const connection of Object.values(tx.state.connections)) {
    if (connection.walletId === walletId && connection.status === 'connected') {
      connection.status = 'disconnected'
      connection.disconnectedAt = now
    }
  }
  const id = `conn_${String(++tx.state.seq.connection).padStart(6, '0')}`
  const connection: ConnectionRecord = {
    id,
    userId,
    walletId,
    provider,
    network,
    status: 'connected',
    connectedAt: now,
    disconnectedAt: null,
  }
  tx.state.connections[id] = connection
  return connection
}

/** Idempotent: disconnecting an already disconnected connection is fine. */
export function disconnectWallet(tx: Tx, connectionId: string, userId?: string): void {
  const connection = tx.state.connections[connectionId]
  if (!connection) throw new HttpError('NOT_FOUND', { details: { resource: 'wallet-connection' } })
  if (userId !== undefined && connection.userId !== userId) throw new HttpError('FORBIDDEN')
  if (connection.status === 'connected') {
    connection.status = 'disconnected'
    connection.disconnectedAt = new Date(tx.now).toISOString()
  }
}
