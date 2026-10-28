import type { Image } from '@/contracts'

import type { ArtworkKey } from '../db/state'

// The four unique Figma artworks, one WebP per width (spec 02 §9). Vite fingerprints the files
// (long-lived cache); the database stores only the key, so a rebuild never leaves stale URLs.

const WIDTHS = [250, 750, 1000] as const
const FULL_SIZE = 1000

const files = import.meta.glob<string>('/src/assets/NFTs/*/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
})

export const ARTWORK_ALT: Record<ArtworkKey, string> = {
  'ape-varsity': 'Macaco de óculos redondos e jaqueta universitária verde',
  'gorilla-bucket-hat': 'Gorila de chapéu bucket verde e moletom roxo',
  'gorilla-turtleneck': 'Gorila de gola alta verde e blazer claro',
  'ape-headphones': 'Macaco dourado com fones de ouvido verdes',
}

export const ARTWORK_KEYS = Object.keys(ARTWORK_ALT) as ArtworkKey[]

function fileUrl(width: number, key: ArtworkKey): string {
  const url = files[`/src/assets/NFTs/${String(width)}/${key}.webp`]
  if (url === undefined) throw new Error(`Missing artwork ${String(width)}/${key}.webp`)
  return url
}

/** `<name> — <artwork description>`; without a name, just the description. */
export function artworkImage(key: ArtworkKey, name?: string): Image {
  const srcSet = WIDTHS.map((width) => ({ url: fileUrl(width, key), width }))
  const first = srcSet[0]
  if (!first) throw new Error('No artwork variants')
  return {
    url: first.url,
    srcSet,
    alt: name ? `${name} — ${ARTWORK_ALT[key]}` : ARTWORK_ALT[key],
    width: FULL_SIZE,
    height: FULL_SIZE,
  }
}

export const ARTWORK_WIDTHS = WIDTHS
