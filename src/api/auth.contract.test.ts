import { describe, expect, it } from 'vitest'

import { authApi, profileApi } from '@/api'
import { CREDENTIALS } from '@/mocks/fixtures/credentials'
import { must } from '@/lib/test-utils'

import { actAs, as, loginAs, rejection, serveMockApi } from './contract-kit'

const mock = serveMockApi()

const validSignup = { username: 'novousuario', email: 'novo@kurio.example', password: 'Senha1234' }

describe('auth.signup', () => {
  it('creates the account and returns the same payload as login', async () => {
    const payload = await authApi.signup(validSignup)
    expect(payload.user).toMatchObject({
      username: 'novousuario',
      displayName: 'novousuario',
      email: 'novo@kurio.example',
      avatarUrl: null,
    })
    expect(payload.token).toMatch(/^[0-9a-f]{32}$/)
    as(payload.token)
    expect((await authApi.session()).user.id).toBe(payload.user.id)
  })

  it('never stores the password in plaintext', async () => {
    await authApi.signup(validSignup)
    expect(JSON.stringify(mock.control.snapshot())).not.toContain('Senha1234')
  })

  it('rejects an existing email, ignoring case, with a field on email', async () => {
    const error = await rejection(() =>
      authApi.signup({ ...validSignup, email: 'ANA@kurio.example' }),
    )
    expect(error).toMatchObject({ status: 409, code: 'EMAIL_TAKEN' })
    expect(error.fields).toHaveProperty('email')
  })

  it('rejects an existing username with a field on username', async () => {
    const error = await rejection(() => authApi.signup({ ...validSignup, username: 'anasouza' }))
    expect(error).toMatchObject({ status: 409, code: 'USERNAME_TAKEN' })
    expect(error.fields).toHaveProperty('username')
  })

  it('answers 422 with a message per invalid field', async () => {
    const error = await rejection(() =>
      authApi.signup({ username: 'A', email: 'nope', password: 'short' }),
    )
    expect(error).toMatchObject({ status: 422, code: 'VALIDATION_FAILED' })
    expect(Object.keys(error.fields ?? {}).sort()).toEqual(['email', 'password', 'username'])
  })
})

describe('auth.login, session and logout', () => {
  it('returns a token, its expiry and the user', async () => {
    const payload = await authApi.login({
      email: CREDENTIALS.ana.email,
      password: CREDENTIALS.ana.password,
    })
    expect(payload.user.id).toBe('usr_ana')
    expect(Date.parse(payload.expiresAt)).toBeGreaterThan(Date.now())
  })

  it('answers INVALID_CREDENTIALS without revealing which field was wrong', async () => {
    const wrongPassword = await rejection(() =>
      authApi.login({ email: CREDENTIALS.ana.email, password: 'wrong-password1' }),
    )
    const unknownEmail = await rejection(() =>
      authApi.login({ email: 'ninguem@kurio.example', password: 'wrong-password1' }),
    )
    expect(wrongPassword).toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS' })
    expect(unknownEmail.message).toBe(wrongPassword.message)
    expect(unknownEmail.fields).toBeUndefined()
  })

  it('validates the body (422)', async () => {
    const error = await rejection(() => authApi.login({ email: 'x', password: '' }))
    expect(error).toMatchObject({ status: 422, code: 'VALIDATION_FAILED' })
  })

  it('looks the session up, and 401s without or with an unknown token', async () => {
    await actAs('bruno')
    expect((await authApi.session()).user.id).toBe('usr_bruno')
    as()
    expect(await rejection(() => authApi.session())).toMatchObject({
      status: 401,
      code: 'UNAUTHENTICATED',
    })
    as('0123456789abcdef0123456789abcdef')
    expect(await rejection(() => authApi.session())).toMatchObject({ code: 'UNAUTHENTICATED' })
  })

  it('reports an expired session once, as SESSION_EXPIRED', async () => {
    await actAs('ana')
    mock.control.expireSessions('usr_ana')
    expect(await rejection(() => authApi.session())).toMatchObject({
      status: 401,
      code: 'SESSION_EXPIRED',
    })
    // The expired session was deleted, so a second call no longer knows the token.
    expect(await rejection(() => authApi.session())).toMatchObject({ code: 'UNAUTHENTICATED' })
  })

  it('invalidates the token on logout, and succeeds when it is already invalid', async () => {
    await actAs('ana')
    await authApi.logout()
    expect(await rejection(() => authApi.session())).toMatchObject({ code: 'UNAUTHENTICATED' })
    await expect(authApi.logout()).resolves.toBeUndefined()
    as()
    await expect(authApi.logout()).resolves.toBeUndefined()
  })
})

describe('profile', () => {
  it('returns the profile of the session user only', async () => {
    await actAs('ana')
    expect(await profileApi.get()).toMatchObject({
      id: 'usr_ana',
      ensName: 'ana',
      displayName: 'Ana Souza',
    })
    await actAs('bruno')
    expect(await profileApi.get()).toMatchObject({ id: 'usr_bruno', ensName: null })
  })

  it('401s without a session', async () => {
    expect(await rejection(() => profileApi.get())).toMatchObject({ status: 401 })
  })

  const update = {
    displayName: 'Ana Maria Souza',
    username: 'anasouza',
    email: 'ana@kurio.example',
    ensName: 'anamaria',
    walletNickname: 'Principal',
  }

  it('updates the details and persists them', async () => {
    await actAs('ana')
    expect(await profileApi.update(update)).toMatchObject({
      displayName: 'Ana Maria Souza',
      ensName: 'anamaria',
    })
    expect((await profileApi.get()).walletNickname).toBe('Principal')
  })

  it('validates (422) and reports uniqueness conflicts', async () => {
    await actAs('ana')
    expect(
      await rejection(() => profileApi.update({ ...update, displayName: '', ensName: 'A' })),
    ).toMatchObject({
      status: 422,
    })
    expect(
      await rejection(() => profileApi.update({ ...update, username: 'brunolima' })),
    ).toMatchObject({
      status: 409,
      code: 'USERNAME_TAKEN',
    })
    expect(
      await rejection(() => profileApi.update({ ...update, email: 'BRUNO@kurio.example' })),
    ).toMatchObject({ status: 409, code: 'EMAIL_TAKEN' })
  })

  it('requires the full set of fields for a new account', async () => {
    await actAs('bruno')
    const error = await rejection(() =>
      profileApi.update({
        ...update,
        username: 'brunolima',
        email: 'bruno@kurio.example',
        ensName: '',
      }),
    )
    expect(error.fields).toHaveProperty('ensName')
  })

  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])

  it('accepts a PNG avatar, serves it back and removes it', async () => {
    await actAs('ana')
    const profile = await profileApi.uploadAvatar(new File([png], 'a.png', { type: 'image/png' }))
    expect(profile.avatarUrl).toMatch(/^data:image\/png;base64,/)
    expect((await authApi.session()).user.avatarUrl).toBe(profile.avatarUrl)
    expect((await profileApi.removeAvatar()).avatarUrl).toBeNull()
  })

  it('answers 415 for another type or for bytes that do not match, and 413 over 2 MB', async () => {
    await actAs('ana')
    const gif = new File([new Uint8Array([0x47, 0x49, 0x46, 0x38])], 'a.gif', { type: 'image/gif' })
    expect(await rejection(() => profileApi.uploadAvatar(gif))).toMatchObject({
      status: 415,
      code: 'UNSUPPORTED_MEDIA_TYPE',
    })
    const fake = new File([new Uint8Array(20)], 'a.png', { type: 'image/png' })
    expect(await rejection(() => profileApi.uploadAvatar(fake))).toMatchObject({ status: 415 })
    const big = new Uint8Array(2 * 1024 * 1024 + 1)
    big.set(png)
    const error = await rejection(() =>
      profileApi.uploadAvatar(new File([big], 'big.png', { type: 'image/png' })),
    )
    expect(error).toMatchObject({ status: 413, code: 'PAYLOAD_TOO_LARGE' })
    expect(error.details).toEqual({ maxBytes: 2 * 1024 * 1024 })
  })

  it('changes the password only with the current one and revokes the other sessions', async () => {
    const other = await loginAs('ana')
    const current = await actAs('ana')
    const wrong = await rejection(() =>
      profileApi.changePassword({
        currentPassword: 'not-the-password1',
        newPassword: 'Nova#Senha2026',
      }),
    )
    expect(wrong).toMatchObject({ status: 422 })
    expect(wrong.fields).toHaveProperty('currentPassword')

    await profileApi.changePassword({
      currentPassword: CREDENTIALS.ana.password,
      newPassword: 'Nova#Senha2026',
    })
    expect((await authApi.session()).user.id).toBe('usr_ana')
    as(other)
    expect(await rejection(() => authApi.session())).toMatchObject({ code: 'UNAUTHENTICATED' })
    as()
    expect(
      await rejection(() =>
        authApi.login({ email: CREDENTIALS.ana.email, password: CREDENTIALS.ana.password }),
      ),
    ).toMatchObject({ code: 'INVALID_CREDENTIALS' })
    expect(
      must(await authApi.login({ email: CREDENTIALS.ana.email, password: 'Nova#Senha2026' })).token,
    ).not.toBe(current)
  })

  it('rejects a new password equal to the current one', async () => {
    await actAs('ana')
    const error = await rejection(() =>
      profileApi.changePassword({
        currentPassword: CREDENTIALS.ana.password,
        newPassword: CREDENTIALS.ana.password,
      }),
    )
    expect(error.fields).toHaveProperty('newPassword')
  })
})
