import { z } from 'zod'

import { eth } from '@/lib/money'

import { Eth, Image, IsoDateTime, NetworkId, NftId, Page } from './common'

export const CategoryId = z.enum([
  'arte-digital',
  'fotografia',
  'musica',
  'arte-3d',
  'colecionaveis',
  'generativa',
  'jogos',
  'assinaturas',
  'utilidade',
])
export type CategoryId = z.infer<typeof CategoryId>

/** Labels as drawn in the Figma filters. */
export const CATEGORY_LABELS: Record<CategoryId, string> = {
  'arte-digital': 'Arte digital',
  fotografia: 'Fotografia',
  musica: 'Música',
  'arte-3d': 'Arte 3D',
  colecionaveis: 'Colecionáveis',
  generativa: 'Generativa',
  jogos: 'Jogos',
  assinaturas: 'Assinaturas',
  utilidade: 'Utilidade',
}

export const NETWORK_LABELS: Record<NetworkId, string> = {
  ethereum: 'Ethereum',
  polygon: 'Polygon',
  solana: 'Solana',
}

export const NftSegment = z.enum(['all', 'new', 'trending'])
export type NftSegment = z.infer<typeof NftSegment>

export const NftSort = z.enum(['recent', 'price-asc', 'price-desc', 'popular'])
export type NftSort = z.infer<typeof NftSort>

export const Rarity = z.enum(['common', 'rare', 'epic', 'legendary'])
export type Rarity = z.infer<typeof Rarity>

export const EditionId = z.enum(['unique', 'limited-10', 'limited-50', 'open'])
export type EditionId = z.infer<typeof EditionId>

/** Normalized listing parameters: the shape the API applies and echoes back as `applied`. */
export const NftListQuery = z
  .object({
    q: z.string().trim().max(80, 'Use no máximo 80 caracteres.').optional(),
    categories: z.array(CategoryId).optional(),
    networks: z.array(NetworkId).optional(),
    minPrice: Eth.optional(),
    maxPrice: Eth.optional(),
    segment: NftSegment.default('all'),
    sort: NftSort.default('recent'),
    favorites: z.literal(true).optional(),
    page: z.int().min(1).default(1),
    pageSize: z.int().min(1).max(48).default(9),
  })
  .refine(
    (query) =>
      query.minPrice === undefined ||
      query.maxPrice === undefined ||
      eth.cmp(query.minPrice, query.maxPrice) <= 0,
    { error: 'O preço mínimo não pode ser maior que o máximo.', path: ['minPrice'] },
  )
export type NftListQuery = z.output<typeof NftListQuery>
/** What callers pass: every field with a default is optional. */
export type NftListQueryInput = z.input<typeof NftListQuery>

const csv = (value: unknown) =>
  typeof value === 'string'
    ? value
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
    : value

/** Query string form: arrays are comma-joined, numbers and `favorites=true` arrive as strings. */
export const NftListWireQuery = z.preprocess((raw) => {
  if (typeof raw !== 'object' || raw === null) return raw
  const query: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (value === '' || value === undefined) continue
    if (key === 'categories' || key === 'networks') query[key] = csv(value)
    else if ((key === 'page' || key === 'pageSize') && typeof value === 'string')
      query[key] = Number(value)
    else if (key === 'favorites' && value === 'true') query[key] = true
    else query[key] = value
  }
  return query
}, NftListQuery)

/** Serializes a query to the wire; `undefined` and empty values are dropped. */
export function toWireQuery(query: NftListQueryInput): Record<string, string> {
  const wire: Record<string, string> = {}
  const set = (key: string, value: string | number | boolean | undefined) => {
    if (value !== undefined && value !== '') wire[key] = String(value)
  }
  set('q', query.q?.trim())
  if (query.categories?.length) set('categories', query.categories.join(','))
  if (query.networks?.length) set('networks', query.networks.join(','))
  set('minPrice', query.minPrice)
  set('maxPrice', query.maxPrice)
  set('segment', query.segment)
  set('sort', query.sort)
  if (query.favorites) set('favorites', true)
  set('page', query.page)
  set('pageSize', query.pageSize)
  return wire
}

export const NftSummary = z.object({
  id: NftId,
  name: z.string(),
  collection: z.object({ id: z.string(), name: z.string() }),
  category: CategoryId,
  network: NetworkId,
  image: Image,
  /** Every edition sells at this price (as in Figma). */
  price: Eth,
  previousPrice: Eth.optional(),
  rarity: Rarity,
  /** True while at least one edition has stock. */
  available: z.boolean(),
  listedAt: IsoDateTime,
  /** Increases on every price or availability change. */
  version: z.int(),
})
export type NftSummary = z.infer<typeof NftSummary>

export const Facets = z.object({
  categories: z.array(z.object({ id: CategoryId, label: z.string(), count: z.int() })),
  networks: z.array(z.object({ id: NetworkId, label: z.string(), count: z.int() })),
  price: z.object({ min: Eth, max: Eth }).nullable(),
})
export type Facets = z.infer<typeof Facets>

export const NftListResponse = Page(NftSummary).extend({
  applied: NftListQuery,
  facets: Facets,
})
export type NftListResponse = z.infer<typeof NftListResponse>

export const Edition = z.object({
  id: EditionId,
  label: z.enum(['1/1', '1/10', '1/50', 'ABERTA']),
  /** `null`: open edition. */
  supply: z.int().nullable(),
  /** What remains after pending orders' reservations; `null` for an open edition. */
  available: z.int().nullable(),
  maxPerOrder: z.int(),
})
export type Edition = z.infer<typeof Edition>

export const NftDetail = NftSummary.extend({
  description: z.string(),
  longDescription: z.array(z.string()),
  tokenId: z.string(),
  creator: z.object({ name: z.string(), username: z.string() }),
  attributes: z.array(z.string()),
  /** Feeds the "Rede / Contrato / Direitos autorais" list, values in the order the labels mean. */
  specs: z.object({
    network: z.string(),
    royalty: z.string(),
    contract: z.object({ address: z.string(), standard: z.enum(['ERC-721', 'SPL']) }),
  }),
  royaltyBps: z.int(),
  images: z.array(Image).min(1).max(4),
  editions: z.array(Edition).min(1).max(4),
  rating: z.number().min(0).max(5),
  reviewCount: z.int(),
  reviews: z
    .array(
      z.object({
        id: z.string(),
        author: z.string(),
        rating: z.int().min(1).max(5),
        comment: z.string(),
        createdAt: IsoDateTime,
      }),
    )
    .max(3),
})
export type NftDetail = z.infer<typeof NftDetail>

export const RelatedResponse = z.object({ items: z.array(NftSummary).max(5) })
export type RelatedResponse = z.infer<typeof RelatedResponse>

const HeroSlide = z.object({
  id: z.string(),
  nftId: NftId,
  eyebrow: z.string(),
  title: z.string(),
  /** Mobile copy: Figma uses different text on the mobile hero. */
  shortTitle: z.string(),
  description: z.string(),
  shortDescription: z.string(),
  image: Image,
})

export const Highlights = z.object({
  hero: z.array(HeroSlide),
  featured: z
    .object({ nftId: NftId, title: z.string(), subtitle: z.string(), image: Image })
    .nullable(),
})
export type Highlights = z.infer<typeof Highlights>
