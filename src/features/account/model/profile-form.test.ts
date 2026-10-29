import { describe, expect, it } from 'vitest'

import type { Profile } from '@/contracts'

import {
  passwordFilled,
  profileChanged,
  ProfileFormSchema,
  profileDefaults,
  type ProfileFormValues,
} from './profile-form'

const PROFILE: Profile = {
  id: 'usr_ana',
  displayName: 'Ana Souza',
  username: 'anasouza',
  email: 'ana@kurio.example',
  ensName: 'ana',
  walletNickname: 'Carteira principal',
  avatarUrl: null,
  createdAt: '2026-05-10T12:00:00.000Z',
}

const valid = (patch: Partial<ProfileFormValues> = {}): ProfileFormValues => ({
  ...profileDefaults(PROFILE),
  ...patch,
})

/** Field name → first message, in the form the fields read them. */
function errors(values: ProfileFormValues): Record<string, string> {
  const result = ProfileFormSchema.safeParse(values)
  if (result.success) return {}
  const out: Record<string, string> = {}
  for (const issue of result.error.issues) {
    const name = String(issue.path[0])
    out[name] ??= issue.message
  }
  return out
}

describe('ProfileFormSchema (ACC-04, ACC-10)', () => {
  it('accepts the saved profile with an empty password section', () => {
    expect(errors(valid())).toEqual({})
  })

  it('requires every profile field', () => {
    const missing = errors(
      valid({ displayName: '', username: '', email: '', ensName: '', walletNickname: '' }),
    )
    expect(Object.keys(missing).sort()).toEqual([
      'displayName',
      'email',
      'ensName',
      'username',
      'walletNickname',
    ])
  })

  it('treats a new account (no ENS name or nickname) as incomplete', () => {
    const bruno = { ...PROFILE, ensName: null, walletNickname: null }
    expect(Object.keys(errors(profileDefaults(bruno))).sort()).toEqual([
      'ensName',
      'walletNickname',
    ])
  })

  it('skips the password section while its three fields are empty', () => {
    expect(passwordFilled(valid())).toBe(false)
    expect(errors(valid())).toEqual({})
  })

  it('requires all three password fields as soon as one is filled', () => {
    expect(errors(valid({ newPassword: 'Senha1234' }))).toEqual({
      currentPassword: 'Informe a senha atual.',
      confirmPassword: 'Confirme a nova senha.',
    })
    expect(errors(valid({ currentPassword: 'Senha1234' }))).toEqual({
      newPassword: 'Informe a nova senha.',
      confirmPassword: 'Confirme a nova senha.',
    })
  })

  it('applies the password policy to the new password', () => {
    const weak = errors(
      valid({ currentPassword: 'Senha1234', newPassword: 'curta', confirmPassword: 'curta' }),
    )
    expect(weak).toEqual({ newPassword: 'Use pelo menos 8 caracteres.' })
    const noDigit = errors(
      valid({ currentPassword: 'Senha1234', newPassword: 'somenteletras', confirmPassword: 'x' }),
    )
    expect(noDigit.newPassword).toBe('A senha precisa ter pelo menos um número.')
  })

  it('refuses a new password equal to the current one', () => {
    expect(
      errors(
        valid({
          currentPassword: 'Senha1234',
          newPassword: 'Senha1234',
          confirmPassword: 'Senha1234',
        }),
      ),
    ).toEqual({ newPassword: 'A nova senha deve ser diferente da atual.' })
  })

  it('requires the confirmation to match', () => {
    expect(
      errors(
        valid({
          currentPassword: 'Senha1234',
          newPassword: 'Outra12345',
          confirmPassword: 'Outra123456',
        }),
      ),
    ).toEqual({ confirmPassword: 'As senhas não coincidem.' })
  })

  it('reports password and profile errors together', () => {
    const both = errors(valid({ displayName: '', newPassword: 'Senha1234' }))
    expect(Object.keys(both).sort()).toEqual(['confirmPassword', 'currentPassword', 'displayName'])
  })

  it('accepts a complete, valid section', () => {
    expect(
      errors(
        valid({
          currentPassword: 'Senha1234',
          newPassword: 'Outra12345',
          confirmPassword: 'Outra12345',
        }),
      ),
    ).toEqual({})
  })
})

describe('profileChanged', () => {
  const body = {
    displayName: 'Ana Souza',
    username: 'anasouza',
    email: 'ana@kurio.example',
    ensName: 'ana',
    walletNickname: 'Carteira principal',
  }

  it('is false for the saved values, whatever the e-mail case', () => {
    expect(profileChanged(body, PROFILE)).toBe(false)
    expect(profileChanged({ ...body, email: 'ANA@kurio.example' }, PROFILE)).toBe(false)
  })

  it('is true when any field differs', () => {
    expect(profileChanged({ ...body, displayName: 'Ana S.' }, PROFILE)).toBe(true)
    expect(profileChanged({ ...body, ensName: 'outra' }, PROFILE)).toBe(true)
    expect(profileChanged(body, { ...PROFILE, ensName: null })).toBe(true)
  })
})
