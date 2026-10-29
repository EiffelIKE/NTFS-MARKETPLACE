import { describe, expect, it } from 'vitest'

import { walletsApi } from '@/api'
import type { CreateWalletBody, WalletFields } from '@/contracts'
import { must } from '@/lib/test-utils'
import { evmAddress, solanaAddress } from '@/mocks/fixtures/addresses'
import { omit } from '@/mocks/lib/omit'

import { actAs, as, rejection, serveMockApi } from './contract-kit'

const mock = serveMockApi()

const base: CreateWalletBody = {
  role: 'primary',
  displayName: 'Carla Mendes',
  nickname: 'Carteira da Carla',
  network: 'ethereum',
  profileName: 'Carla M.',
  address: evmAddress('C4A1', 'D00D'),
  provider: 'metamask',
  referralCode: 'CARLA-01',
  email: 'carla@kurio.example',
  ensName: 'carla',
}

describe('wallets.list', () => {
  it('returns the session user slots, primary first', async () => {
    await actAs('ana')
    const { items } = await walletsApi.list()
    expect(items.map((w) => [w.role, w.network, w.provider])).toEqual([
      ['primary', 'ethereum', 'metamask'],
      ['secondary', 'polygon', 'coinbase'],
    ])
    expect(items[1]?.alternateWallet).toBe('nova.kurio.eth')
    await actAs('carla')
    expect((await walletsApi.list()).items).toEqual([])
  })

  it('401s without a session', async () => {
    expect(await rejection(() => walletsApi.list())).toMatchObject({ status: 401 })
  })
})

describe('wallets.create', () => {
  it('registers a wallet and derives its family from the address', async () => {
    await actAs('carla')
    const wallet = await walletsApi.create(base)
    expect(wallet).toMatchObject({ role: 'primary', family: 'evm', nickname: 'Carteira da Carla' })
    const solana = await walletsApi.create({
      ...base,
      role: 'secondary',
      network: 'solana',
      address: solanaAddress('carla'),
      provider: 'coinbase',
    })
    expect(solana.family).toBe('solana')
  })

  it('answers 422 for invalid fields and for an address that does not fit the network', async () => {
    await actAs('carla')
    const invalid = await rejection(() =>
      walletsApi.create({ ...base, nickname: '', referralCode: 'x' }),
    )
    expect(invalid).toMatchObject({ status: 422, code: 'VALIDATION_FAILED' })
    expect(Object.keys(invalid.fields ?? {}).sort()).toEqual(['nickname', 'referralCode'])
    const wrongNetwork = await rejection(() => walletsApi.create({ ...base, network: 'solana' }))
    expect(wrongNetwork.fields).toEqual({ address: ['Endereço inválido para a rede selecionada.'] })
    const wrongFamily = await rejection(() =>
      walletsApi.create({ ...base, address: solanaAddress('carla') }),
    )
    expect(wrongFamily.fields).toHaveProperty('address')
  })

  it('answers 409 WALLET_ROLE_TAKEN for a used slot and WALLET_DUPLICATE for the same address', async () => {
    await actAs('carla')
    await walletsApi.create(base)
    expect(
      await rejection(() => walletsApi.create({ ...base, address: evmAddress('1111', '2222') })),
    ).toMatchObject({
      status: 409,
      code: 'WALLET_ROLE_TAKEN',
    })
    const duplicate = await rejection(() =>
      walletsApi.create({
        ...base,
        role: 'secondary',
        address: base.address.toUpperCase().replace('0X', '0x'),
      }),
    )
    expect(duplicate).toMatchObject({ status: 409, code: 'WALLET_DUPLICATE' })
    expect(duplicate.fields).toHaveProperty('address')
  })

  it('lets two users register the same address (the rule is per user)', async () => {
    await actAs('carla')
    await walletsApi.create({
      ...base,
      address: must(mock.control.snapshot().wallets.wal_000003).address,
    })
    await actAs('bruno')
    expect((await walletsApi.list()).items).toHaveLength(1)
  })
})

describe('wallets.update', () => {
  const fields: WalletFields = omit(base, 'role')

  it('updates a wallet and clears the optional alternate wallet when left out', async () => {
    await actAs('ana')
    const secondary = must((await walletsApi.list()).items[1])
    const { id } = secondary
    const current: WalletFields = omit(
      secondary,
      'id',
      'role',
      'family',
      'createdAt',
      'updatedAt',
      'alternateWallet',
    )
    const updated = await walletsApi.update(id, { ...current, nickname: 'Renomeada' })
    expect(updated).toMatchObject({ id, role: 'secondary', nickname: 'Renomeada' })
    expect(updated.alternateWallet).toBeUndefined()
    expect(Date.parse(updated.updatedAt)).toBeGreaterThanOrEqual(Date.parse(secondary.updatedAt))
  })

  it("answers 403 for another user's wallet, 404 for an unknown one, 422 and 409 for bad input", async () => {
    await actAs('ana')
    expect(await rejection(() => walletsApi.update('wal_000003', fields))).toMatchObject({
      status: 403,
    })
    expect(await rejection(() => walletsApi.update('wal_999999', fields))).toMatchObject({
      status: 404,
    })
    const primary = must((await walletsApi.list()).items[0])
    const secondary = must((await walletsApi.list()).items[1])
    expect(
      await rejection(() => walletsApi.update(primary.id, { ...fields, network: 'solana' })),
    ).toMatchObject({ status: 422 })
    expect(
      await rejection(() =>
        walletsApi.update(primary.id, { ...fields, address: secondary.address }),
      ),
    ).toMatchObject({ status: 409, code: 'WALLET_DUPLICATE' })
  })
})

describe('wallet connections', () => {
  it('connects, closes the previous connection of the same wallet, and lists only mine', async () => {
    await actAs('ana')
    const first = await walletsApi.connect({
      walletId: 'wal_000001',
      provider: 'metamask',
      network: 'ethereum',
    })
    expect(first).toMatchObject({ status: 'connected', disconnectedAt: null })
    const second = await walletsApi.connect({
      walletId: 'wal_000001',
      provider: 'metamask',
      network: 'polygon',
    })
    const { items } = await walletsApi.connections()
    expect(items.map((c) => [c.id, c.status])).toEqual([
      [first.id, 'disconnected'],
      [second.id, 'connected'],
    ])
    await actAs('bruno')
    expect((await walletsApi.connections()).items).toEqual([])
  })

  it('disconnects explicitly (idempotently) and from the test control', async () => {
    await actAs('ana')
    const connection = await walletsApi.connect({
      walletId: 'wal_000001',
      provider: 'metamask',
      network: 'ethereum',
    })
    await walletsApi.disconnect(connection.id)
    await walletsApi.disconnect(connection.id)
    expect((await walletsApi.connections()).items[0]?.status).toBe('disconnected')
    await walletsApi.connect({ walletId: 'wal_000001', provider: 'metamask', network: 'ethereum' })
    mock.control.disconnectWallet()
    expect((await walletsApi.connections()).items.every((c) => c.status === 'disconnected')).toBe(
      true,
    )
  })

  it('rejects the connection in the wallet-reject scenario with WALLET_REJECTED', async () => {
    mock.runtime.useScenario('wallet-reject')
    mock.control.configure({ latency: { kind: 'none' }, walletConnect: { delayMs: 0 } })
    await actAs('ana')
    const error = await rejection(() =>
      walletsApi.connect({ walletId: 'wal_000001', provider: 'metamask', network: 'ethereum' }),
    )
    expect(error).toMatchObject({ status: 409, code: 'WALLET_REJECTED' })
    expect(error.details).toEqual({ walletId: 'wal_000001', network: 'ethereum' })
    expect((await walletsApi.connections()).items).toEqual([])
  })

  it("answers 403, 404 and 422 for another user's wallet, an unknown one and a wrong network family", async () => {
    await actAs('ana')
    const connect = (walletId: string, network: 'ethereum' | 'solana') =>
      walletsApi.connect({ walletId, provider: 'metamask', network })
    expect(await rejection(() => connect('wal_000003', 'ethereum'))).toMatchObject({ status: 403 })
    expect(await rejection(() => connect('wal_999999', 'ethereum'))).toMatchObject({ status: 404 })
    expect(await rejection(() => connect('wal_000001', 'solana'))).toMatchObject({ status: 422 })
    const connection = await connect('wal_000001', 'ethereum')
    await actAs('bruno')
    expect(await rejection(() => walletsApi.disconnect(connection.id))).toMatchObject({
      status: 403,
    })
    expect(await rejection(() => walletsApi.disconnect('conn_999999'))).toMatchObject({
      status: 404,
    })
    as()
    expect(await rejection(() => walletsApi.connections())).toMatchObject({ status: 401 })
  })
})
