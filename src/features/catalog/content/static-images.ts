import type { Image } from '@/contracts'

// Artwork for the static home bands (promos and blog). Same WebP files as the catalog, imported
// from `src/assets` directly: the app never reaches into `@/mocks` (spec 02 §12).

const WIDTHS = [250, 750, 1000] as const

const files = import.meta.glob<string>('/src/assets/NFTs/*/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
})

export type StaticArtwork =
  'ape-varsity' | 'gorilla-bucket-hat' | 'gorilla-turtleneck' | 'ape-headphones'

/** Decorative by default: the band's text already says what the card is about. */
export function staticImage(key: StaticArtwork, alt = ''): Image {
  const srcSet = WIDTHS.map((width) => {
    const url = files[`/src/assets/NFTs/${String(width)}/${key}.webp`]
    if (url === undefined) throw new Error(`Missing artwork ${String(width)}/${key}.webp`)
    return { url, width }
  })
  const [first] = srcSet
  if (!first) throw new Error('No artwork variants')
  return { url: first.url, srcSet, alt, width: 1000, height: 1000 }
}
