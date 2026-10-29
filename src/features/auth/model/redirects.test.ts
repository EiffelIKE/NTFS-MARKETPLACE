import { isRedirect } from '@tanstack/react-router'
import { describe, expect, it, vi } from 'vitest'

import { closeTarget, redirectIfAuthenticated, requireAuth } from './redirects'
import type { SessionState } from './session'

function guard(valid: boolean, state: SessionState, href = '/wallets?tab=1#x') {
  return requireAuth({
    context: { session: { ensureValid: vi.fn(() => Promise.resolve(valid)), get: () => state } },
    location: { href },
  })
}

async function redirected(promise: Promise<void> | void) {
  try {
    await promise
  } catch (error) {
    if (isRedirect(error)) return error.options
    throw error
  }
  return null
}

describe('requireAuth (AUTH-11, AUTH-14)', () => {
  it('lets a valid session through', async () => {
    expect(await redirected(guard(true, { status: 'guest', lastSignOut: null }))).toBeNull()
  })

  it('sends a visitor to login with the full path, replacing the history entry', async () => {
    expect(await redirected(guard(false, { status: 'guest', lastSignOut: null }))).toMatchObject({
      to: '/login',
      search: { redirect: '/wallets?tab=1#x' },
      replace: true,
    })
  })

  it('adds reason=expired only after an expiry', async () => {
    const visitor = await redirected(guard(false, { status: 'guest', lastSignOut: null }))
    const afterLogout = await redirected(guard(false, { status: 'guest', lastSignOut: 'logout' }))
    const afterExpiry = await redirected(guard(false, { status: 'guest', lastSignOut: 'expired' }))
    expect(visitor?.search).not.toHaveProperty('reason')
    expect(afterLogout?.search).not.toHaveProperty('reason')
    expect(afterExpiry?.search).toMatchObject({ reason: 'expired', redirect: '/wallets?tab=1#x' })
  })
})

describe('redirectIfAuthenticated (AUTH-12)', () => {
  const run = (isAuthenticated: boolean, redirectTo?: string) => {
    try {
      redirectIfAuthenticated({
        context: { session: { isAuthenticated: () => isAuthenticated } },
        search: { redirect: redirectTo },
      })
    } catch (error) {
      if (isRedirect(error)) return error.options
      throw error
    }
    return null
  }

  it('does nothing for a visitor', () => {
    expect(run(false, '/cart')).toBeNull()
  })

  it('sends a signed-in user to the redirect, or home', () => {
    expect(run(true, '/cart?x=1')).toMatchObject({ href: '/cart?x=1', replace: true })
    expect(run(true)).toMatchObject({ href: '/' })
  })
})

describe('closeTarget (AUTH-19)', () => {
  const isProtected = (pathname: string) => ['/profile', '/wallets', '/checkout'].includes(pathname)

  it('keeps a public redirect, search and hash included', () => {
    expect(closeTarget(isProtected, '/?favorites=1')).toBe('/?favorites=1')
    expect(closeTarget(isProtected, '/nfts/abc#reviews')).toBe('/nfts/abc#reviews')
  })

  it('sends a protected target home, because the visitor cannot open it', () => {
    expect(closeTarget(isProtected, '/profile')).toBe('/')
    expect(closeTarget(isProtected, '/wallets?tab=1#x')).toBe('/')
  })

  it('goes home without a redirect', () => {
    expect(closeTarget(isProtected, undefined)).toBe('/')
  })
})
