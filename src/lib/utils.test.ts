import { describe, expect, it } from 'vitest'

import { cn } from './utils'

describe('cn', () => {
  it('keeps a custom font size next to a text color', () => {
    expect(cn('text-body-lg text-foreground', 'text-ink')).toBe('text-body-lg text-ink')
  })

  it('merges custom font sizes and radii', () => {
    expect(cn('text-body', 'text-title')).toBe('text-title')
    expect(cn('rounded-sm', 'rounded-icon-button')).toBe('rounded-icon-button')
  })
})
