import { describe, expect, it } from 'vitest'

import { parseEnv } from './env-schema'

describe('parseEnv', () => {
  it('applies defaults when variables are missing', () => {
    expect(parseEnv({})).toEqual({ VITE_API_BASE_URL: '/api', VITE_API_TIMEOUT_MS: 10_000 })
  })

  it('coerces the timeout from a string', () => {
    expect(parseEnv({ VITE_API_TIMEOUT_MS: '2500' }).VITE_API_TIMEOUT_MS).toBe(2500)
  })

  it.each(['-1', '0', '1.5', 'abc'])(
    'rejects VITE_API_TIMEOUT_MS=%s naming the variable',
    (value) => {
      expect(() => parseEnv({ VITE_API_TIMEOUT_MS: value })).toThrow(
        'Invalid environment: VITE_API_TIMEOUT_MS — expected positive integer',
      )
    },
  )

  it('rejects an empty base URL', () => {
    expect(() => parseEnv({ VITE_API_BASE_URL: '' })).toThrow(/VITE_API_BASE_URL/)
  })
})
