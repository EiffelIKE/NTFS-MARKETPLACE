import { beforeEach, describe, expect, it } from 'vitest'

import { profileApi, walletsApi } from '@/api'
import { actAs, serveMockApi } from '@/api/contract-kit'
import type { Profile, Wallet } from '@/contracts'
import { ApiError } from '@/lib/http/errors'
import { must } from '@/lib/test-utils'

import {
  CheckoutFormSchema,
  defaultWallet,
  mapServerFields,
  prefill,
  toCreateOrderBody,
  valuesFromOrder,
  walletBaseline,
  walletSwitchPatch,
} from './form'

serveMockApi()

let profile: Profile
let primary: Wallet
let secondary: Wallet

beforeEach(async () => {
  await actAs('ana')
  profile = await profileApi.get()
  const wallets = (await walletsApi.list()).items
  primary = must(wallets.find((wallet) => wallet.role === 'primary'))
  secondary = must(wallets.find((wallet) => wallet.role === 'secondary'))
})

describe('prefill (CHK-06)', () => {
  it('takes the person from the profile and the payment side from the wallet', () => {
    const values = prefill(profile, primary)
    expect(values).toMatchObject({
      displayName: 'Ana Souza',
      username: 'anasouza',
      email: 'ana@kurio.example',
      walletId: primary.id,
      walletAddress: primary.address,
      provider: primary.provider,
      network: primary.network,
      profileName: primary.profileName,
      referralCode: primary.referralCode,
      note: '',
    })
    expect(CheckoutFormSchema.safeParse(values).success).toBe(true)
  })

  it('opens with the primary wallet, else the first one', () => {
    expect(defaultWallet([secondary, primary])).toBe(primary)
    expect(defaultWallet([secondary])).toBe(secondary)
    expect(defaultWallet([])).toBeUndefined()
  })
})

describe('walletSwitchPatch (CHK-10, CHK-11)', () => {
  it('refills every wallet field the user did not edit, and always the address', () => {
    const baseline = prefill(profile, primary)
    const patch = walletSwitchPatch(secondary, baseline, baseline)
    expect(patch).toMatchObject({
      walletId: secondary.id,
      walletAddress: secondary.address,
      provider: secondary.provider,
      network: secondary.network,
      referralCode: secondary.referralCode,
    })
  })

  it('keeps what the user edited', () => {
    const baseline = prefill(profile, primary)
    const edited = { ...baseline, referralCode: 'MY-CODE', profileName: 'Meu perfil' }
    const patch = walletSwitchPatch(secondary, edited, baseline)
    expect(patch).not.toHaveProperty('referralCode')
    expect(patch).not.toHaveProperty('profileName')
    expect(patch.walletAddress).toBe(secondary.address)
  })

  it('resets an edited network the new wallet cannot use', () => {
    const baseline = prefill(profile, primary)
    const onSolana = { ...baseline, network: 'solana' as const }
    const evm = { ...secondary, family: 'evm' as const, network: 'polygon' as const }
    expect(walletSwitchPatch(evm, onSolana, baseline).network).toBe('polygon')
  })

  it('takes the baseline of the new wallet for the next switch', () => {
    const baseline = prefill(profile, primary)
    const next = walletBaseline(baseline, secondary)
    expect(next.walletId).toBe(secondary.id)
    expect(next.displayName).toBe(baseline.displayName)
  })
})

describe('toCreateOrderBody (CHK-23)', () => {
  it('omits a blank note and a blank alternate wallet', () => {
    const body = toCreateOrderBody(
      { ...prefill(profile, primary), alternateWallet: '  ', note: ' ' },
      'q1',
    )
    expect(body).not.toHaveProperty('note')
    expect(body.collector).not.toHaveProperty('alternateWallet')
    expect(body.quoteId).toBe('q1')
  })

  it('keeps a trimmed note and a filled alternate wallet', () => {
    const body = toCreateOrderBody(
      { ...prefill(profile, primary), alternateWallet: 'ana.eth', note: ' Obrigada ' },
      'q1',
    )
    expect(body.note).toBe('Obrigada')
    expect(body.collector.alternateWallet).toBe('ana.eth')
  })

  it('rejects a note over 500 characters with the contract rule', () => {
    const result = CheckoutFormSchema.safeParse({
      ...prefill(profile, primary),
      note: 'x'.repeat(501),
    })
    expect(result.success).toBe(false)
  })

  it('reads the form back from an order (a declined attempt reopens as filled)', () => {
    const values = { ...prefill(profile, primary), note: 'Oi' }
    const body = toCreateOrderBody(values, 'q1')
    const back = valuesFromOrder({
      wallet: primary,
      network: body.network,
      collector: body.collector,
      note: body.note ?? null,
    })
    expect(back).toEqual(values)
  })
})

describe('mapServerFields (CHK-08)', () => {
  const error = new ApiError('http', 'Invalid', {
    status: 422,
    code: 'VALIDATION_FAILED',
    fields: {
      'collector.referralCode': ['Código inválido.'],
      quoteId: ['Cotação inválida.'],
      network: ['Rede inválida.'],
    },
  })

  it('rewrites collector.<field> and routes the rest to the form alert', () => {
    const { error: mapped, unmapped } = mapServerFields(error, ['referralCode', 'network'])
    expect(mapped.fields).toEqual({
      referralCode: ['Código inválido.'],
      network: ['Rede inválida.'],
    })
    expect(unmapped).toEqual(['Cotação inválida.'])
  })
})
