import { MutationObserver, QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'

import { walletsApi } from '@/api'
import { as, loginAs, rejection, serveMockApi } from '@/api/contract-kit'
import type { Profile, Wallet, WalletFields, WalletList } from '@/contracts'
import type { SessionController } from '@/features/auth/model/session'

import { accountKeys } from './account-keys'
import { updateProfileOptions } from './profile-mutations'
import { saveWalletOptions, withWallet, type SaveWalletVariables } from './wallets-mutations'

const mock = serveMockApi()

const ANA_ID = 'usr_ana'

function session(overrides: Partial<SessionController> = {}) {
  const updateUser = vi.fn()
  const guard = {
    epoch: () => 0,
    isCurrent: () => true,
    get: () =>
      ({ status: 'authenticated', user: { id: ANA_ID } }) as ReturnType<SessionController['get']>,
    updateUser,
    ...overrides,
  }
  return { guard, updateUser }
}

const BODY = {
  displayName: 'Ana S.',
  username: 'anasouza',
  email: 'ana@kurio.example',
  ensName: 'ana',
  walletNickname: 'Carteira principal',
}

describe('updateProfileOptions (ACC-06)', () => {
  it('replaces the cached profile and patches the session user', async () => {
    as(await loginAs('ana'))
    const client = new QueryClient()
    const { guard, updateUser } = session()
    const saved = await new MutationObserver(client, updateProfileOptions(client, guard)).mutate(
      BODY,
    )

    expect(saved.displayName).toBe('Ana S.')
    expect(client.getQueryData<Profile>(accountKeys.profile(ANA_ID))?.displayName).toBe('Ana S.')
    expect(updateUser).toHaveBeenCalledWith({
      displayName: 'Ana S.',
      username: 'anasouza',
      email: 'ana@kurio.example',
      avatarUrl: null,
    })
  })

  it('a refused update changes neither the cache nor the session', async () => {
    as(await loginAs('ana'))
    const client = new QueryClient()
    const { guard, updateUser } = session()
    const error = await rejection(() =>
      new MutationObserver(client, updateProfileOptions(client, guard)).mutate({
        ...BODY,
        username: 'brunolima',
      }),
    )

    expect(error.code).toBe('USERNAME_TAKEN')
    expect(client.getQueryData(accountKeys.profile(ANA_ID))).toBeUndefined()
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('drops a result that arrives after the session changed', async () => {
    as(await loginAs('ana'))
    const client = new QueryClient()
    let epoch = 0
    const { guard, updateUser } = session({
      epoch: () => epoch,
      isCurrent: (value: number) => value === epoch,
    })
    const run = new MutationObserver(client, updateProfileOptions(client, guard)).mutate(BODY)
    epoch += 1
    await run

    expect(client.getQueryData(accountKeys.profile(ANA_ID))).toBeUndefined()
    expect(updateUser).not.toHaveBeenCalled()
  })
})

const wallet = (role: Wallet['role'], nickname: string): Wallet => ({
  id: `wal_${role}`,
  role,
  family: 'evm',
  displayName: 'Ana Souza',
  nickname,
  network: 'ethereum',
  profileName: 'Ana S.',
  address: `0x${'ab'.repeat(20)}`,
  provider: 'metamask',
  referralCode: 'ANA-KURIO',
  email: 'ana@kurio.example',
  ensName: 'ana',
  createdAt: '2026-05-10T12:00:00.000Z',
  updatedAt: '2026-05-10T12:00:00.000Z',
})

describe('withWallet (ACC-20)', () => {
  it('inserts into an empty list, replaces by role and keeps the primary first', () => {
    const secondary = wallet('secondary', 'B')
    const first = withWallet(undefined, secondary)
    expect(first.items).toEqual([secondary])

    const list: WalletList = first
    const added = withWallet(list, wallet('primary', 'A'))
    expect(added.items.map((item) => item.role)).toEqual(['primary', 'secondary'])

    const renamed = withWallet(added, wallet('primary', 'A2'))
    expect(renamed.items.map((item) => item.nickname)).toEqual(['A2', 'B'])
  })
})

describe('saveWalletOptions (ACC-16, ACC-20)', () => {
  const fields = (patch: Partial<WalletFields> = {}): WalletFields => ({
    displayName: 'Bruno Lima',
    nickname: 'Reserva',
    network: 'polygon',
    profileName: 'Bruno L.',
    address: `0x${'1f'.repeat(20)}`,
    provider: 'walletconnect',
    referralCode: 'BRUNO-01',
    email: 'bruno@kurio.example',
    ensName: 'bruno',
    ...patch,
  })

  it('creates an empty slot, caches the wallet, then updates it by id', async () => {
    as(await loginAs('bruno'))
    const client = new QueryClient()
    const { guard } = session({
      get: () =>
        ({ status: 'authenticated', user: { id: 'usr_bruno' } }) as ReturnType<
          SessionController['get']
        >,
    })
    const save = (variables: SaveWalletVariables) =>
      new MutationObserver(client, saveWalletOptions(client, guard)).mutate(variables)

    const created = await save({ role: 'secondary', fields: fields() })
    expect(created.role).toBe('secondary')
    expect(mock.control.requests({ op: 'wallets.create' })).toHaveLength(1)
    expect(
      client.getQueryData<WalletList>(accountKeys.wallets('usr_bruno'))?.items.map((w) => w.id),
    ).toEqual([created.id])

    await save({
      walletId: created.id,
      role: 'secondary',
      fields: fields({ nickname: 'Reserva 2' }),
    })
    expect(mock.control.requests({ op: 'wallets.update' })).toHaveLength(1)
    expect(
      client.getQueryData<WalletList>(accountKeys.wallets('usr_bruno'))?.items[0]?.nickname,
    ).toBe('Reserva 2')
  })

  it('reports WALLET_DUPLICATE and leaves the cache alone', async () => {
    as(await loginAs('bruno'))
    const client = new QueryClient()
    const { guard } = session({
      get: () =>
        ({ status: 'authenticated', user: { id: 'usr_bruno' } }) as ReturnType<
          SessionController['get']
        >,
    })
    const primary = (await walletsApi.list()).items[0]
    const error = await rejection(() =>
      new MutationObserver(client, saveWalletOptions(client, guard)).mutate({
        role: 'secondary',
        fields: fields({ address: primary?.address ?? '' }),
      }),
    )
    expect(error.code).toBe('WALLET_DUPLICATE')
    expect(client.getQueryData(accountKeys.wallets('usr_bruno'))).toBeUndefined()
  })
})
