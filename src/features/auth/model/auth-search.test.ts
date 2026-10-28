import { describe, expect, it } from 'vitest'

import { authSearchSchema } from './auth-search'

describe('authSearchSchema', () => {
  it('keeps a same-origin path, with its search and hash', () => {
    expect(authSearchSchema.parse({ redirect: '/cart' })).toEqual({ redirect: '/cart' })
    expect(authSearchSchema.parse({ redirect: '/wallets?tab=1#x' }).redirect).toBe(
      '/wallets?tab=1#x',
    )
  })

  it.each(['https://evil.test', '//evil.test', 'cart', 42, ['/cart']])('drops %j', (redirect) => {
    expect(authSearchSchema.parse({ redirect }).redirect).toBeUndefined()
  })

  it('accepts a missing param', () => {
    expect(authSearchSchema.parse({})).toEqual({})
  })

  it('accepts only the "expired" reason', () => {
    expect(authSearchSchema.parse({ reason: 'expired' }).reason).toBe('expired')
    expect(authSearchSchema.parse({ reason: 'other' }).reason).toBeUndefined()
    expect(authSearchSchema.parse({ reason: ['expired'] }).reason).toBeUndefined()
  })
})
