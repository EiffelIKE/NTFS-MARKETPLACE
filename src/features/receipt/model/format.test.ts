import { describe, expect, it } from 'vitest'

import { formatOrderDate, shortHash } from './format'

describe('shortHash (RCPT-09)', () => {
  const hash = `0x${'1a2b3c4d'.repeat(8)}`

  it('keeps the first 8 and the last 4 characters', () => {
    expect(shortHash(hash)).toBe('0x1a2b3c…3c4d')
  })

  it('leaves a short value alone', () => {
    expect(shortHash('0xabc')).toBe('0xabc')
  })
})

describe('formatOrderDate (RCPT-09)', () => {
  it('writes the date in pt-BR', () => {
    // Midday UTC is the same calendar day in every time zone from -12 to +11.
    expect(formatOrderDate('2026-07-29T12:00:00Z')).toBe('29 de jul. de 2026')
  })
})
