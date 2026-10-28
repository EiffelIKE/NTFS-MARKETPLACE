import { describe, expect, it } from 'vitest'

import type { Wallet } from '@/contracts'

import {
  addressPlaceholder,
  copyFromPrimary,
  walletDefaults,
  WalletFormSchema,
  type WalletFormValues,
} from './wallet-form'

const EVM = '0xC4A1000000000000000000000000000000D00D00'
const SOLANA = 'Fq3Zq7mVd2kRrYxJt8hGnWb5LcPsA9UeXoT4yNvKiD6B'

const PRIMARY: Wallet = {
  id: 'wal_000001',
  role: 'primary',
  family: 'evm',
  displayName: 'Ana Souza',
  nickname: 'Carteira principal',
  network: 'ethereum',
  profileName: 'Ana S.',
  address: EVM,
  alternateWallet: 'nova.kurio.eth',
  provider: 'metamask',
  referralCode: 'ANA-KURIO',
  email: 'ana@kurio.example',
  ensName: 'ana',
  createdAt: '2026-05-10T12:00:00.000Z',
  updatedAt: '2026-05-10T12:00:00.000Z',
}

const filled = (patch: Partial<WalletFormValues> = {}): WalletFormValues => ({
  ...walletDefaults(PRIMARY),
  ...patch,
})

function errors(values: WalletFormValues): Record<string, string> {
  const result = WalletFormSchema.safeParse(values)
  if (result.success) return {}
  const out: Record<string, string> = {}
  for (const issue of result.error.issues) out[String(issue.path[0])] ??= issue.message
  return out
}

describe('WalletFormSchema (ACC-17)', () => {
  it('accepts a saved wallet', () => {
    expect(errors(filled())).toEqual({})
  })

  it('rejects an EVM address on Solana and a Solana address on an EVM network', () => {
    expect(errors(filled({ network: 'solana' }))).toEqual({
      address: 'Endereço inválido para a rede selecionada.',
    })
    expect(errors(filled({ network: 'polygon', address: SOLANA }))).toEqual({
      address: 'Endereço inválido para a rede selecionada.',
    })
    expect(errors(filled({ network: 'solana', address: SOLANA }))).toEqual({})
  })

  it('revalidates an address already typed when the network changes', () => {
    expect(errors(filled({ network: 'ethereum' }))).toEqual({})
    expect(errors(filled({ network: 'solana' })).address).toBeDefined()
  })

  it('names the select that was not chosen', () => {
    const missing = errors(filled({ network: '', provider: '' }))
    expect(missing).toEqual({ network: 'Selecione uma rede.', provider: 'Selecione uma carteira.' })
  })

  it('requires the marked fields and leaves the alternate wallet optional', () => {
    const empty = errors(walletDefaults())
    expect(Object.keys(empty).sort()).toEqual([
      'address',
      'displayName',
      'email',
      'ensName',
      'network',
      'nickname',
      'profileName',
      'provider',
      'referralCode',
    ])
    expect(errors(filled({ alternateWallet: '' }))).toEqual({})
    expect(errors(filled({ alternateWallet: 'qualquer' })).alternateWallet).toBeDefined()
  })

  it('drops an empty alternate wallet from the body', () => {
    const result = WalletFormSchema.safeParse(filled({ alternateWallet: '  ' }))
    expect(result.success && 'alternateWallet' in result.data).toBe(false)
  })
})

describe('copyFromPrimary (ACC-18)', () => {
  it('copies the shared fields and leaves nickname, address and alternate empty', () => {
    const copied = copyFromPrimary(PRIMARY)
    expect(copied).toEqual({
      displayName: 'Ana Souza',
      profileName: 'Ana S.',
      network: 'ethereum',
      provider: 'metamask',
      referralCode: 'ANA-KURIO',
      email: 'ana@kurio.example',
      ensName: 'ana',
    })
    expect(copied).not.toHaveProperty('address')
    expect(copied).not.toHaveProperty('nickname')
    expect(copied).not.toHaveProperty('alternateWallet')
  })
})

describe('addressPlaceholder', () => {
  it('follows the network', () => {
    expect(addressPlaceholder('solana')).toBe('Endereço Solana da carteira')
    expect(addressPlaceholder('polygon')).toBe('Endereço 0x da carteira')
    expect(addressPlaceholder('')).toBe('Endereço 0x da carteira')
  })
})
