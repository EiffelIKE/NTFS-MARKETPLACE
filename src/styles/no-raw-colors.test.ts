import { describe, expect, it } from 'vitest'

// DS-02: color literals live only in theme.css (and exported SVGs, which are not scanned here).

const sources = import.meta.glob<string>(['/src/**/*.{ts,tsx,css}', '!/src/**/*.test.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
})

// The mock catalog is prose: NFT names and descriptions such as `Golden Beat #207` look like hex
// colors (spec 02 amendment).
const ALLOWED = new Set(['/src/styles/theme.css', '/src/mocks/fixtures/catalog.ts'])

// A `#` right after a word and a space is an NFT number (`Emerald Ape #042`), not a color.
const patterns: [string, RegExp][] = [
  ['hex color', /(?<!\w )#[0-9a-f]{3,8}\b/gi],
  ['rgb()/hsl()/oklch()', /\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\(/gi],
  ['arbitrary color class', /-\[#/g],
]

// Hex-looking strings that are not colors (URL fragments in code).
const IGNORED = [/href=["']#/i, /hash[:=]/i]

function findRawColors(path: string, source: string) {
  const hits: string[] = []
  source.split('\n').forEach((line, index) => {
    if (IGNORED.some((re) => re.test(line))) return
    for (const [label, re] of patterns) {
      for (const match of line.matchAll(re)) {
        hits.push(`${path}:${String(index + 1)} ${label} "${match[0]}"`)
      }
    }
  })
  return hits
}

describe('no raw colors outside theme.css', () => {
  it('scans the source tree', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(10)
  })

  it('finds no color literals', () => {
    const hits = Object.entries(sources)
      .filter(([path]) => !ALLOWED.has(path))
      .flatMap(([path, source]) => findRawColors(path, source))
    expect(hits).toEqual([])
  })
})
