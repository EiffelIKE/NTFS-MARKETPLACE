import { describe, expect, it } from 'vitest'

import themeCss from './theme.css?raw'

// Contrast table from spec 01 design §3 (DS-07), checked against the real token values.

function readTokens(css: string) {
  const tokens = new Map<string, string>()
  for (const match of css.matchAll(/--color-([a-z-]+):\s*(#[0-9a-f]{6})\s*;/gi)) {
    const [, name, value] = match
    if (name && value) tokens.set(name, value)
  }
  for (const match of css.matchAll(/--color-([a-z-]+):\s*var\(--color-([a-z-]+)\)\s*;/gi)) {
    const [, name, target] = match
    const value = target ? tokens.get(target) : undefined
    if (name && value) tokens.set(name, value)
  }
  return tokens
}

function luminance(hex: string) {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const [r = 0, g = 0, b = 0] = channels.map((c) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  )
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string) {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (high + 0.05) / (low + 0.05)
}

const tokens = readTokens(themeCss)

function token(name: string) {
  const value = tokens.get(name)
  if (!value) throw new Error(`Missing token --color-${name}`)
  return value
}

const surfaces = ['ink', 'surface-card', 'surface-dark'] as const

// [foreground, ratios on ink / surface-card / surface-dark, minimum required]
const textPairs: [string, [number, number, number], number][] = [
  ['foreground', [17.1, 15.57, 13.29], 4.5],
  ['text-secondary', [9.53, 8.68, 7.41], 4.5],
  ['secondary', [6.72, 6.12, 5.22], 4.5],
  ['text-accent', [8.47, 7.72, 6.59], 4.5],
  ['focus', [8.47, 7.72, 6.59], 3],
  ['primary', [6.85, 6.24, 5.33], 4.5],
  ['error', [7.54, 6.87, 5.87], 4.5],
  ['success', [10.35, 9.43, 8.05], 4.5],
  ['warning', [11.32, 10.31, 8.8], 4.5],
]

describe('token contrast (WCAG 2.2 AA)', () => {
  for (const [name, expected, minimum] of textPairs) {
    surfaces.forEach((surface, i) => {
      it(`${name} on ${surface} is ${String(expected[i])} : 1 (≥ ${String(minimum)})`, () => {
        const ratio = contrast(token(name), token(surface))
        expect(ratio).toBeCloseTo(expected[i] ?? 0, 2)
        expect(ratio).toBeGreaterThanOrEqual(minimum)
      })
    })
  }

  it('ink label on a primary fill is 6.85 : 1', () => {
    expect(contrast(token('ink'), token('primary'))).toBeCloseTo(6.85, 2)
  })

  it('error text on error-surface is 6.16 : 1', () => {
    expect(contrast(token('error'), token('error-surface'))).toBeCloseTo(6.16, 2)
  })

  it('keeps the borders decorative-only (DS-08: never the sole state cue)', () => {
    for (const surface of surfaces) {
      expect(contrast(token('border'), token(surface))).toBeLessThan(3)
      expect(contrast(token('border-soft'), token(surface))).toBeLessThan(3)
    }
  })
})
