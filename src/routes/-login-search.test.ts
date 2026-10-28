import { describe, expect, it } from 'vitest'

import { loginSearchSchema } from './-login-search'

describe('loginSearchSchema', () => {
  it('keeps a same-origin path', () => {
    expect(loginSearchSchema.parse({ redirect: '/cart' })).toEqual({ redirect: '/cart' })
  })

  it.each(['https://evil.test', '//evil.test', 'cart', 42, ['/cart']])('drops %j', (redirect) => {
    expect(loginSearchSchema.parse({ redirect }).redirect).toBeUndefined()
  })

  it('accepts a missing param', () => {
    expect(loginSearchSchema.parse({}).redirect).toBeUndefined()
  })
})
