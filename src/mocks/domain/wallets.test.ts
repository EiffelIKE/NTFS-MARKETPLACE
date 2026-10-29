import { describe, expect, it } from 'vitest'

import type { CreateWalletBody, WalletFields } from '@/contracts'
import { must } from '@/lib/test-utils'

import { createBus } from '../db/bus'
import { seed } from '../db/seed'
import { createMemoryStorage, createStore, type Store } from '../db/store'
import { evmAddress, solanaAddress } from '../fixtures/addresses'
import { HttpError } from '../lib/http-error'
import { omit } from '../lib/omit'
import {
  assertConnectable,
  connectWallet,
  createWallet,
  disconnectWallet,
  isConnected,
  ownedWallet,
  updateWallet,
  userWallets,
} from './wallets'

function newStore(): Store {
  return createStore({ storage: createMemoryStorage(), bus: createBus(), seed: () => seed() })
}

const body: CreateWalletBody = {
  role: 'primary',
  displayName: 'Carla Mendes',
  nickname: 'Carteira',
  network: 'ethereum',
  profileName: 'Carla M.',
  address: evmAddress('C4A1', 'D00D'),
  provider: 'metamask',
  referralCode: 'CARLA-01',
  email: 'carla@kurio.example',
  ensName: 'carla',
}

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn()
  } catch (error) {
    if (error instanceof HttpError) return error.code
    throw error
  }
  return undefined
}

describe('createWallet', () => {
  it('stores a wallet with a sequential id and the derived family', () => {
    const store = newStore()
    const wallet = store.write((tx) => createWallet(tx, 'usr_carla', body))
    expect(wallet).toMatchObject({ id: 'wal_000004', userId: 'usr_carla', family: 'evm' })
    const solana = store.write((tx) =>
      createWallet(tx, 'usr_carla', {
        ...body,
        role: 'secondary',
        network: 'solana',
        address: solanaAddress('x'),
      }),
    )
    expect(solana).toMatchObject({ id: 'wal_000005', family: 'solana' })
    expect(store.read((state) => userWallets(state, 'usr_carla'))).toHaveLength(2)
  })

  it('rejects a taken role and, case-insensitively, a duplicate EVM address', () => {
    const store = newStore()
    store.write((tx) => createWallet(tx, 'usr_carla', body))
    expect(codeOf(() => store.write((tx) => createWallet(tx, 'usr_carla', body)))).toBe(
      'WALLET_ROLE_TAKEN',
    )
    const upper = `0x${body.address.slice(2).toUpperCase()}`
    expect(
      codeOf(() =>
        store.write((tx) =>
          createWallet(tx, 'usr_carla', { ...body, role: 'secondary', address: upper }),
        ),
      ),
    ).toBe('WALLET_DUPLICATE')
  })

  it('compares Solana addresses exactly (case matters)', () => {
    const store = newStore()
    const address = solanaAddress('case')
    const swapped = address.replace(/[a-z]/, (c) => c.toUpperCase())
    expect(swapped).not.toBe(address)
    store.write((tx) => createWallet(tx, 'usr_carla', { ...body, network: 'solana', address }))
    expect(
      codeOf(() =>
        store.write((tx) =>
          createWallet(tx, 'usr_carla', {
            ...body,
            role: 'secondary',
            network: 'solana',
            address: swapped,
          }),
        ),
      ),
    ).toBeUndefined()
  })

  it('leaves nothing behind when the write is rejected', () => {
    const store = newStore()
    store.write((tx) => createWallet(tx, 'usr_carla', body))
    const before = store.snapshot()
    expect(codeOf(() => store.write((tx) => createWallet(tx, 'usr_carla', body)))).toBeDefined()
    expect(store.snapshot()).toEqual(before)
  })
})

describe('ownedWallet and updateWallet', () => {
  const fields: WalletFields = omit(body, 'role')

  it('is 404 for unknown, 403 for someone else, and the record for the owner', () => {
    const state = seed()
    expect(codeOf(() => ownedWallet(state, 'usr_ana', 'wal_999999'))).toBe('NOT_FOUND')
    expect(codeOf(() => ownedWallet(state, 'usr_ana', 'wal_000003'))).toBe('FORBIDDEN')
    expect(ownedWallet(state, 'usr_ana', 'wal_000001').userId).toBe('usr_ana')
  })

  it('updates in place, keeps the role and clears an omitted alternate wallet', () => {
    const store = newStore()
    const before = must(store.read((state) => state.wallets.wal_000002))
    expect(before.alternateWallet).toBeDefined()
    const next = store.write((tx) =>
      updateWallet(tx, 'usr_ana', 'wal_000002', {
        ...fields,
        address: before.address,
        network: 'polygon',
      } satisfies WalletFields),
    )
    expect(next).toMatchObject({ id: 'wal_000002', role: 'secondary', nickname: 'Carteira' })
    expect(next).not.toHaveProperty('alternateWallet')
  })

  it('allows keeping its own address but not taking another wallet of the same user', () => {
    const store = newStore()
    const primary = must(store.read((state) => state.wallets.wal_000001))
    const secondary = must(store.read((state) => state.wallets.wal_000002))
    const update = (address: string) => () =>
      store.write((tx) => updateWallet(tx, 'usr_ana', 'wal_000001', { ...fields, address }))
    expect(codeOf(update(primary.address))).toBeUndefined()
    expect(codeOf(update(secondary.address))).toBe('WALLET_DUPLICATE')
  })
})

describe('connections', () => {
  it('connects, replaces the previous connection of the wallet and reports isConnected', () => {
    const store = newStore()
    const first = store.write((tx) =>
      connectWallet(tx, 'usr_ana', 'wal_000001', 'metamask', 'ethereum'),
    )
    expect(store.read((s) => isConnected(s, 'usr_ana', 'wal_000001', 'metamask', 'ethereum'))).toBe(
      true,
    )
    const second = store.write((tx) =>
      connectWallet(tx, 'usr_ana', 'wal_000001', 'metamask', 'polygon'),
    )
    const connections = store.snapshot().connections
    expect(must(connections[first.id]).status).toBe('disconnected')
    expect(must(connections[first.id]).disconnectedAt).not.toBeNull()
    expect(must(connections[second.id]).status).toBe('connected')
    expect(store.read((s) => isConnected(s, 'usr_ana', 'wal_000001', 'metamask', 'ethereum'))).toBe(
      false,
    )
    expect(store.read((s) => isConnected(s, 'usr_ana', 'wal_000001', 'metamask', 'polygon'))).toBe(
      true,
    )
  })

  it('disconnects idempotently and checks ownership and existence', () => {
    const store = newStore()
    const { id } = store.write((tx) =>
      connectWallet(tx, 'usr_ana', 'wal_000001', 'metamask', 'ethereum'),
    )
    store.write((tx) => {
      disconnectWallet(tx, id, 'usr_ana')
    })
    const stamp = must(store.snapshot().connections[id]).disconnectedAt
    store.write((tx) => {
      disconnectWallet(tx, id)
    })
    expect(must(store.snapshot().connections[id]).disconnectedAt).toBe(stamp)
    const disconnect = (connectionId: string, userId?: string) => () => {
      store.write((tx) => {
        disconnectWallet(tx, connectionId, userId)
      })
    }
    expect(codeOf(disconnect(id, 'usr_bruno'))).toBe('FORBIDDEN')
    expect(codeOf(disconnect('conn_999999'))).toBe('NOT_FOUND')
  })

  it('only connects wallets to networks of their own family', () => {
    const state = seed()
    expect(assertConnectable(state, 'usr_ana', 'wal_000001', 'polygon').id).toBe('wal_000001')
    expect(codeOf(() => assertConnectable(state, 'usr_ana', 'wal_000001', 'solana'))).toBe(
      'VALIDATION_FAILED',
    )
    expect(codeOf(() => assertConnectable(state, 'usr_ana', 'wal_000003', 'ethereum'))).toBe(
      'FORBIDDEN',
    )
  })
})
