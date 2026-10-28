import {
  CATEGORY_LABELS,
  NETWORK_LABELS,
  CategoryId,
  NetworkId,
  type Facets,
  type NftId,
  type NftListQuery,
  type NftListResponse,
} from '@/contracts'
import { eth } from '@/lib/money'

import type { NftRecord } from '../db/state'
import { CATALOG_REFERENCE_DATE } from '../fixtures/catalog'
import { toNftSummary } from './mappers'

const NEW_WINDOW_MS = 30 * 24 * 60 * 60 * 1000
const TRENDING_MIN_SCORE = 70

/** Lower-case, accent-free text, so `musica` finds "Música". */
export function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

function searchText(nft: NftRecord): string {
  return fold(
    [nft.name, nft.collection.name, nft.creator.name, nft.creator.username, ...nft.attributes].join(
      ' ',
    ),
  )
}

type Dimension = 'search' | 'category' | 'network' | 'price' | 'segment' | 'favorites'

function matches(
  nft: NftRecord,
  query: NftListQuery,
  favorites: ReadonlySet<NftId> | null,
  skip?: Dimension,
): boolean {
  if (skip !== 'search' && query.q) {
    // Every word must appear somewhere in the searchable text.
    const haystack = searchText(nft)
    if (
      !fold(query.q)
        .split(/\s+/)
        .filter(Boolean)
        .every((word) => haystack.includes(word))
    ) {
      return false
    }
  }
  if (skip !== 'category' && query.categories?.length && !query.categories.includes(nft.category)) {
    return false
  }
  if (skip !== 'network' && query.networks?.length && !query.networks.includes(nft.network)) {
    return false
  }
  if (skip !== 'price') {
    if (query.minPrice !== undefined && eth.cmp(nft.price, query.minPrice) < 0) return false
    if (query.maxPrice !== undefined && eth.cmp(nft.price, query.maxPrice) > 0) return false
  }
  if (skip !== 'segment') {
    if (query.segment === 'new') {
      if (Date.parse(nft.listedAt) < Date.parse(CATALOG_REFERENCE_DATE) - NEW_WINDOW_MS)
        return false
    } else if (query.segment === 'trending' && nft.trendingScore < TRENDING_MIN_SCORE) {
      return false
    }
  }
  if (skip !== 'favorites' && query.favorites && !favorites?.has(nft.id)) return false
  return true
}

const byId = (a: NftRecord, b: NftRecord) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

function comparator(sort: NftListQuery['sort']): (a: NftRecord, b: NftRecord) => number {
  switch (sort) {
    case 'recent':
      return (a, b) => Date.parse(b.listedAt) - Date.parse(a.listedAt) || byId(a, b)
    case 'price-asc':
      return (a, b) => eth.cmp(a.price, b.price) || byId(a, b)
    case 'price-desc':
      return (a, b) => eth.cmp(b.price, a.price) || byId(a, b)
    case 'popular':
      return (a, b) => b.trendingScore - a.trendingScore || byId(a, b)
  }
}

/** Dedupes while keeping the caller's order. */
function unique<T>(values: readonly T[] | undefined): T[] | undefined {
  return values ? [...new Set(values)] : undefined
}

/** The parameters the API actually applied: trimmed, deduped, empty lists dropped. */
export function normalizeQuery(query: NftListQuery): NftListQuery {
  const categories = unique(query.categories)
  const networks = unique(query.networks)
  const q = query.q?.trim()
  return {
    ...(q ? { q } : {}),
    ...(categories?.length ? { categories } : {}),
    ...(networks?.length ? { networks } : {}),
    ...(query.minPrice !== undefined && { minPrice: query.minPrice }),
    ...(query.maxPrice !== undefined && { maxPrice: query.maxPrice }),
    segment: query.segment,
    sort: query.sort,
    ...(query.favorites && { favorites: true as const }),
    page: query.page,
    pageSize: query.pageSize,
  }
}

function priceBounds(nfts: NftRecord[]): Facets['price'] {
  const [first, ...rest] = nfts
  if (!first) return null
  let min = first.price
  let max = first.price
  for (const nft of rest) {
    if (eth.cmp(nft.price, min) < 0) min = nft.price
    if (eth.cmp(nft.price, max) > 0) max = nft.price
  }
  return { min, max }
}

/**
 * Filters combine with AND across dimensions and OR within one. Each facet is computed with every
 * other active filter applied (disjunctive faceting), and all values are always listed.
 */
export function queryCatalog(
  nfts: readonly NftRecord[],
  rawQuery: NftListQuery,
  favorites: ReadonlySet<NftId> | null,
): NftListResponse {
  const query = normalizeQuery(rawQuery)
  const filtered = nfts.filter((nft) => matches(nft, query, favorites)).sort(comparator(query.sort))

  const totalItems = filtered.length
  const totalPages = Math.ceil(totalItems / query.pageSize)
  const start = (query.page - 1) * query.pageSize
  const items = filtered.slice(start, start + query.pageSize).map(toNftSummary)

  const withoutCategory = nfts.filter((nft) => matches(nft, query, favorites, 'category'))
  const withoutNetwork = nfts.filter((nft) => matches(nft, query, favorites, 'network'))
  const withoutPrice = nfts.filter((nft) => matches(nft, query, favorites, 'price'))

  return {
    items,
    page: query.page,
    pageSize: query.pageSize,
    totalItems,
    totalPages,
    applied: query,
    facets: {
      categories: CategoryId.options.map((id) => ({
        id,
        label: CATEGORY_LABELS[id],
        count: withoutCategory.filter((nft) => nft.category === id).length,
      })),
      networks: NetworkId.options.map((id) => ({
        id,
        label: NETWORK_LABELS[id],
        count: withoutNetwork.filter((nft) => nft.network === id).length,
      })),
      price: priceBounds(withoutPrice),
    },
  }
}

/** Up to 5 other NFTs of the same collection (newest first), topped up from the same category. */
export function relatedTo(nft: NftRecord, nfts: readonly NftRecord[]): NftRecord[] {
  const others = nfts.filter((other) => other.id !== nft.id).sort(comparator('recent'))
  const sameCollection = others.filter((other) => other.collection.id === nft.collection.id)
  const sameCategory = others.filter(
    (other) => other.collection.id !== nft.collection.id && other.category === nft.category,
  )
  return [...sameCollection, ...sameCategory].slice(0, 5)
}
