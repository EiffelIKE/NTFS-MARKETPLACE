import type { NftSegment, NftSort, Rarity } from '@/contracts'

// pt-BR copy for the catalog controls (spec 05 design §7), as drawn in Figma.

export const SEGMENT_LABELS: Record<NftSegment, string> = {
  all: 'Todos os NFTs',
  new: 'Novos lançamentos',
  trending: 'Em alta',
}

export const SORT_LABELS: Record<NftSort, string> = {
  recent: 'Listados recentemente',
  'price-asc': 'Menor preço',
  'price-desc': 'Maior preço',
  popular: 'Mais populares',
}

/** Only non-common NFTs carry a badge. */
export const RARITY_LABELS: Record<Exclude<Rarity, 'common'>, string> = {
  rare: 'RARO',
  epic: 'ÉPICO',
  legendary: 'LENDÁRIO',
}

/** "1 NFT", "9 NFTs". */
export function nftCount(count: number): string {
  return `${String(count)} ${count === 1 ? 'NFT' : 'NFTs'}`
}
