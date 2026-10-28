import { describe, expect, it } from 'vitest'

import { parseEnv } from './env-schema'

describe('parseEnv', () => {
  it('applies defaults when variables are missing', () => {
    expect(parseEnv({})).toEqual({
      VITE_API_BASE_URL: '/api',
      VITE_API_TIMEOUT_MS: 10_000,
      VITE_ENABLE_MOCKS: true,
      VITE_REALTIME_URL: 'wss://realtime.kurio.example',
    })
  })

  it('rejects a realtime URL that is not absolute, naming the variable', () => {
    expect(() => parseEnv({ VITE_REALTIME_URL: '/socket' })).toThrow(/VITE_REALTIME_URL/)
    expect(parseEnv({ VITE_REALTIME_URL: 'ws://localhost:3001' }).VITE_REALTIME_URL).toBe(
      'ws://localhost:3001',
    )
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

  it('turns the mocks off only with the exact string "false"', () => {
    expect(parseEnv({ VITE_ENABLE_MOCKS: 'false' }).VITE_ENABLE_MOCKS).toBe(false)
    expect(parseEnv({ VITE_ENABLE_MOCKS: 'true' }).VITE_ENABLE_MOCKS).toBe(true)
  })

  it.each(['1', '0', 'TRUE', 'yes', ''])(
    'rejects VITE_ENABLE_MOCKS=%j naming the variable',
    (v) => {
      expect(() => parseEnv({ VITE_ENABLE_MOCKS: v })).toThrow(/VITE_ENABLE_MOCKS/)
    },
  )
})
