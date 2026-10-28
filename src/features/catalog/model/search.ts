import { z } from 'zod'

import {
  CategoryId,
  NetworkId,
  NftSegment,
  NftSort,
  type NftListQuery,
  type NftSegment as Segment,
  type NftSort as Sort,
} from '@/contracts'
import { Eth } from '@/contracts/common'
import { eth } from '@/lib/money'

// The home route's search params (spec 05 design §3). Lists are comma-joined strings and every
// param is optional: a param with its default value is never written, so one state has one URL
// (CAT-01). The router hands over raw strings (`router.ts` serializer), so numbers are coerced here.

export const PAGE_SIZE = 9
const MAX_PAGE = 10_000

/** What the URL can hold. A missing key is the default; there is no `undefined` value. */
export interface CatalogSearch {
  q?: string
  /** Sorted, comma-joined `CategoryId`s. */
  categories?: string
  /** Sorted, comma-joined `NetworkId`s. */
  networks?: string
  minPrice?: Eth
  maxPrice?: Eth
  /** `all` is omitted. */
  segment?: Exclude<Segment, 'all'>
  /** `recent` is omitted. */
  sort?: Exclude<Sort, 'recent'>
  /** 1 is omitted. */
  page?: number
  favorites?: 1
}

/** A change from a control; `page` is never part of it, because every change resets it. `undefined` clears a param. */
export type CatalogChange = {
  [K in keyof Omit<CatalogSearch, 'page'>]?: CatalogSearch[K] | undefined
}

const text = (value: unknown): unknown =>
  typeof value === 'number' || typeof value === 'boolean' ? String(value) : value

/** Keeps the valid ids, deduplicated and sorted, so the same selection is always the same string. */
function canonicalList(value: unknown, valid: readonly string[]): string | undefined {
  const parts = Array.isArray(value)
    ? value.map(String)
    : typeof value === 'string'
      ? value.split(',')
      : []
  const kept = [
    ...new Set(parts.map((part) => part.trim()).filter((p) => valid.includes(p))),
  ].sort()
  return kept.length ? kept.join(',') : undefined
}

// `.optional()` last: a missing key is the default, and a transform output is never "optional".
const list = (valid: readonly string[]) =>
  z
    .unknown()
    .transform((value) => canonicalList(value, valid))
    .optional()

const price = z
  .preprocess(
    text,
    Eth.optional()
      .catch(undefined)
      .transform((value) => (value === undefined ? undefined : eth.normalize(value))),
  )
  .optional()

/** An enum param whose default value is dropped: `segment=all` and no `segment` are one state. */
const choice = <T extends z.ZodEnum<Record<string, string>>>(values: T, defaultValue: z.infer<T>) =>
  z
    .unknown()
    .transform((value) => {
      const parsed = values.safeParse(value)
      return parsed.success && parsed.data !== defaultValue ? parsed.data : undefined
    })
    .optional()

/**
 * Malformed or unknown values fall back to the default instead of failing (CAT-02). A price range
 * with min above max is dropped as a whole.
 */
export const catalogSearch = z
  .object({
    q: z
      .preprocess(text, z.string().trim().max(80))
      .optional()
      .catch(undefined)
      .transform((value) => (value === '' ? undefined : value)),
    categories: list(CategoryId.options),
    networks: list(NetworkId.options),
    minPrice: price,
    maxPrice: price,
    segment: choice(NftSegment, 'all'),
    sort: choice(NftSort, 'recent'),
    page: z.coerce.number().int().min(2).max(MAX_PAGE).optional().catch(undefined),
    favorites: z
      .unknown()
      .transform((value) =>
        value === 1 || value === '1' || value === true ? (1 as const) : undefined,
      )
      .optional(),
  })
  .transform((search): CatalogSearch => {
    const inverted =
      search.minPrice !== undefined &&
      search.maxPrice !== undefined &&
      eth.cmp(search.minPrice, search.maxPrice) > 0
    // Every key is present, `undefined` when absent or dropped: the router merges the raw URL
    // params under the validated ones, so an omitted key would bring its raw value back.
    return {
      ...search,
      ...(inverted && { minPrice: undefined, maxPrice: undefined }),
    } as CatalogSearch
  })

/** Re-runs the schema, so helpers always produce a canonical state. */
function canonical(search: Record<string, unknown>): CatalogSearch {
  return catalogSearch.parse(search)
}

/** "Limpar filtros": the default URL state. */
export const CLEARED: CatalogSearch = {}

/** Applies a control's change and goes back to page 1 (CAT-04). A `undefined` value clears a param. */
export function withChange(prev: CatalogSearch, change: CatalogChange): CatalogSearch {
  return canonical({ ...prev, ...change, page: undefined })
}

/** Changes only the page. */
export function withPage(prev: CatalogSearch, page: number): CatalogSearch {
  return canonical({ ...prev, page: page > 1 ? page : undefined })
}

/** Adds the id to a comma-joined selection, or removes it when it is already there. */
export function toggleInList(current: string | undefined, id: string): string | undefined {
  const ids = current ? current.split(',') : []
  const next = ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]
  return next.length ? next.join(',') : undefined
}

export function splitList<T extends string>(value: string | undefined): T[] {
  return value ? (value.split(',') as T[]) : []
}

/** True when nothing narrows the catalog: `page` and `sort` only reorder or slice it (CAT-13). */
export function isDefaultState(search: CatalogSearch): boolean {
  return (
    search.q === undefined &&
    search.categories === undefined &&
    search.networks === undefined &&
    search.minPrice === undefined &&
    search.maxPrice === undefined &&
    search.segment === undefined &&
    search.favorites === undefined
  )
}

/** Favorites mode with nothing else narrowing it. */
export function isFavoritesOnly(search: CatalogSearch): boolean {
  return (
    search.favorites !== undefined &&
    search.q === undefined &&
    search.categories === undefined &&
    search.networks === undefined &&
    search.minPrice === undefined &&
    search.maxPrice === undefined &&
    search.segment === undefined
  )
}

/** Filters that live in the filters panel, for the badge on the mobile button. */
export function activeFilterCount(search: CatalogSearch): number {
  return (
    splitList(search.categories).length +
    splitList(search.networks).length +
    (search.minPrice !== undefined || search.maxPrice !== undefined ? 1 : 0)
  )
}

/**
 * The request for a URL state. The same state always gives an equal object, so each state maps to
 * one query key and back/forward finds its entry in the cache (CAT-06).
 */
export function toListQuery(search: CatalogSearch): NftListQuery {
  return {
    ...(search.q !== undefined && { q: search.q }),
    ...(search.categories !== undefined && {
      categories: splitList<CategoryId>(search.categories),
    }),
    ...(search.networks !== undefined && { networks: splitList<NetworkId>(search.networks) }),
    ...(search.minPrice !== undefined && { minPrice: search.minPrice }),
    ...(search.maxPrice !== undefined && { maxPrice: search.maxPrice }),
    segment: search.segment ?? 'all',
    sort: search.sort ?? 'recent',
    ...(search.favorites !== undefined && { favorites: true as const }),
    page: search.page ?? 1,
    pageSize: PAGE_SIZE,
  }
}
