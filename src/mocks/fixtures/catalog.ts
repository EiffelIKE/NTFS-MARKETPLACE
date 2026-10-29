import {
  CATEGORY_LABELS,
  type CategoryId,
  type EditionId,
  type Eth,
  type IsoDateTime,
  type NetworkId,
  type Rarity,
} from '@/contracts'

import type { ArtworkKey, EditionRecord, NftRecord } from '../db/state'
import { eth } from '@/lib/money'

import { createPrng, type Prng } from '../lib/prng'
import { evmAddress, solanaAddress } from './addresses'
import { ARTWORK_KEYS } from './artworks'

// The 120-NFT catalog (spec 02 §9): hand-written anchors that match Figma, plus a seeded
// generator that fills the quotas. All ETH values are built with integer arithmetic in units of
// 0.0001 ETH, so no float ever touches a price.

/** Fixture constant so "new" results never depend on the clock. */
export const CATALOG_REFERENCE_DATE = '2026-10-01T00:00:00.000Z'
export const CATALOG_SIZE = 120
export const PRNG_SEED = 20261027

const CATEGORY_COUNTS: Record<CategoryId, number> = {
  'arte-digital': 17,
  fotografia: 6,
  musica: 33,
  'arte-3d': 19,
  colecionaveis: 12,
  generativa: 8,
  jogos: 10,
  assinaturas: 6,
  utilidade: 9,
}

const NETWORK_COUNTS: Record<NetworkId, number> = { ethereum: 50, polygon: 33, solana: 37 }

interface Collection {
  id: string
  name: string
  creators: { name: string; username: string }[]
  /** Name words, so generated names stay on theme. */
  adjectives: string[]
  nouns: string[]
}

const COLLECTIONS: Collection[] = [
  {
    id: 'kurio-apes',
    name: 'Kurio Apes',
    creators: [
      { name: 'Nova Sato', username: 'novasato' },
      { name: 'Teo Marques', username: 'teomarques' },
    ],
    adjectives: ['Emerald', 'Amber', 'Jade', 'Solar', 'Mossy', 'Cobalt'],
    nouns: ['Ape', 'Kong', 'Primate'],
  },
  {
    id: 'cosmic-bloom',
    name: 'Cosmic Bloom',
    creators: [
      { name: 'Lia Fontes', username: 'liafontes' },
      { name: 'Rui Cardoso', username: 'ruicardoso' },
    ],
    adjectives: ['Cosmic', 'Lunar', 'Stellar', 'Nebula', 'Astral'],
    nouns: ['Bloom', 'Petal', 'Orchid'],
  },
  {
    id: 'violet-nomads',
    name: 'Violet Nomads',
    creators: [
      { name: 'Iris Valente', username: 'irisvalente' },
      { name: 'Davi Prado', username: 'daviprado' },
      { name: 'Mara Quintela', username: 'maraquintela' },
    ],
    adjectives: ['Violet', 'Sage', 'Dusty', 'Wild', 'Quiet'],
    nouns: ['Nomad', 'Wanderer', 'Drifter'],
  },
  {
    id: 'ivory-barons',
    name: 'Ivory Barons',
    creators: [
      { name: 'Caio Brandão', username: 'caiobrandao' },
      { name: 'Helena Duarte', username: 'helenaduarte' },
    ],
    adjectives: ['Ivory', 'Pearl', 'Opal', 'Chalk', 'Silken'],
    nouns: ['Baron', 'Duke', 'Count'],
  },
  {
    id: 'golden-beats',
    name: 'Golden Beats',
    creators: [
      { name: 'Otto Ramalho', username: 'ottoramalho' },
      { name: 'Bia Tavares', username: 'biatavares' },
    ],
    adjectives: ['Golden', 'Brass', 'Honey', 'Gilded', 'Velvet'],
    nouns: ['Beat', 'Rhythm', 'Chord', 'Frequency'],
  },
  {
    id: 'golden-signals',
    name: 'Golden Signals',
    creators: [
      { name: 'Yara Pinheiro', username: 'yarapinheiro' },
      { name: 'Enzo Lacerda', username: 'enzolacerda' },
    ],
    adjectives: ['Golden', 'Radiant', 'Amber', 'Bright'],
    nouns: ['Signal', 'Pulse', 'Beacon'],
  },
  {
    id: 'neon-relics',
    name: 'Neon Relics',
    creators: [
      { name: 'Kaito Nunes', username: 'kaitonunes' },
      { name: 'Vera Aragão', username: 'veraaragao' },
      { name: 'Luan Peixoto', username: 'luanpeixoto' },
    ],
    adjectives: ['Neon', 'Electric', 'Cyber', 'Plasma', 'Laser'],
    nouns: ['Vessel', 'Relic', 'Totem', 'Idol'],
  },
  {
    id: 'ember-pilots',
    name: 'Ember Pilots',
    creators: [
      { name: 'Sol Magalhães', username: 'solmagalhaes' },
      { name: 'Dante Faria', username: 'dantefaria' },
    ],
    adjectives: ['Ember', 'Crimson', 'Scarlet', 'Copper', 'Rusty'],
    nouns: ['Pilot', 'Ace', 'Flyer'],
  },
]

const EDITION_DEFS: Record<EditionId, Omit<EditionRecord, 'available'>> = {
  unique: { id: 'unique', label: '1/1', supply: 1, maxPerOrder: 1 },
  'limited-10': { id: 'limited-10', label: '1/10', supply: 10, maxPerOrder: 3 },
  'limited-50': { id: 'limited-50', label: '1/50', supply: 50, maxPerOrder: 5 },
  open: { id: 'open', label: 'ABERTA', supply: null, maxPerOrder: 10 },
}

function edition(id: EditionId, available?: number | null): EditionRecord {
  const def = EDITION_DEFS[id]
  return { ...def, available: available === undefined ? def.supply : available }
}

/** 12345 → "1.2345"; trailing zeros dropped. */
function fromUnits(units: number): Eth {
  const whole = Math.floor(units / 10_000)
  const fraction = String(units % 10_000)
    .padStart(4, '0')
    .replace(/0+$/, '')
  return fraction ? `${String(whole)}.${fraction}` : String(whole)
}

const RARITY_LABELS: Record<Rarity, string> = {
  common: 'Comum',
  rare: 'Raro',
  epic: 'Épico',
  legendary: 'Lendário',
}

const TRAITS = [
  'Óculos',
  'Chapéu',
  'Fones',
  'Jaqueta',
  'Máscara',
  'Coroa',
  'Capuz',
  'Relógio',
  'Esmeralda',
  'Violeta',
  'Dourado',
  'Marfim',
  'Neon',
  'Cósmico',
  'Âmbar',
  'Carmesim',
]

const NETWORK_SPEC_TEXT: Record<NetworkId, string> = {
  ethereum: 'Cunhado na Ethereum com procedência imutável e metadados armazenados no IPFS.',
  polygon: 'Cunhado na Polygon com taxas reduzidas e metadados armazenados no IPFS.',
  solana: 'Cunhado na Solana com liquidação rápida e metadados armazenados on-chain.',
}

const LONG_DESCRIPTIONS = [
  'Cada peça da coleção nasce de um esboço feito à mão e é finalizada digitalmente, camada por camada, até ganhar personalidade própria. O resultado é um colecionável que mistura traço artesanal e acabamento digital.',
  'Ao adquirir este NFT você recebe a arte em alta resolução, o certificado de autenticidade registrado na rede e acesso à comunidade de colecionadores, com lançamentos antecipados e eventos exclusivos.',
  'A procedência é verificável a qualquer momento: o histórico de propriedade fica registrado na rede e os metadados são armazenados de forma descentralizada, sem depender da plataforma.',
  'Os criadores reservam uma parte das vendas secundárias como royalties, garantindo que o trabalho continue sendo recompensado enquanto a coleção ganha valor.',
]

const REVIEW_COMMENTS = [
  'Arte linda e entrega rápida. O certificado chegou na hora.',
  'Superou minhas expectativas, o acabamento é impecável.',
  'Ótima peça para começar a coleção. Recomendo!',
  'Boa procedência e comunidade muito ativa.',
  'Gostei bastante dos detalhes. Vale cada centavo.',
]
const REVIEW_AUTHORS = ['Marina C.', 'Paulo R.', 'Joana T.', 'Felipe A.', 'Sabrina L.', 'Rafael M.']

const pad = (value: number, length: number) => String(value).padStart(length, '0')

function slug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/#/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

interface Seed {
  name: string
  number: number
  collection: Collection
  category: CategoryId
  network: NetworkId
  artwork: ArtworkKey
  price: Eth
  previousPrice?: Eth
  rarity: Rarity
  listedAt: IsoDateTime
  trendingScore: number
  editions: EditionRecord[]
  creatorIndex?: number
  attributes?: string[]
  description?: string
  longDescription?: string[]
  rating?: number
  reviewCount?: number
  royaltyBps?: number
  contractAddress?: string
}

function collectionOf(id: string): Collection {
  const found = COLLECTIONS.find((c) => c.id === id)
  if (!found) throw new Error(`Unknown collection ${id}`)
  return found
}

function toRecord(seed: Seed, prng: Prng): NftRecord {
  const id = slug(seed.name)
  const creator =
    seed.collection.creators[seed.creatorIndex ?? seed.number % seed.collection.creators.length]
  if (!creator) throw new Error('Collection without creators')
  const royaltyBps = seed.royaltyBps ?? prng.pick([250, 500, 500, 750, 1000])
  const family = seed.network === 'solana' ? 'solana' : 'evm'
  const reviewCount = seed.reviewCount ?? prng.int(0, 60)
  const gallery = [seed.artwork, ...ARTWORK_KEYS.filter((key) => key !== seed.artwork)].slice(
    0,
    prng.int(1, 4),
  )
  const attributes = seed.attributes ?? [
    prng.pick(TRAITS),
    prng.pick(TRAITS.slice(8)),
    RARITY_LABELS[seed.rarity],
  ]
  return {
    id,
    name: seed.name,
    collection: { id: seed.collection.id, name: seed.collection.name },
    category: seed.category,
    network: seed.network,
    artwork: seed.artwork,
    gallery,
    // Normalized, so string equality on prices is exact ('12.30' and '12.3' are one value).
    price: eth.normalize(seed.price),
    ...(seed.previousPrice !== undefined && { previousPrice: eth.normalize(seed.previousPrice) }),
    rarity: seed.rarity,
    listedAt: seed.listedAt,
    trendingScore: seed.trendingScore,
    version: 1,
    description:
      seed.description ??
      `Um colecionável digital da coleção ${seed.collection.name}, na categoria ${CATEGORY_LABELS[seed.category].toLowerCase()}, verificado na ${seed.network === 'ethereum' ? 'Ethereum' : seed.network === 'polygon' ? 'Polygon' : 'Solana'}.`,
    longDescription: seed.longDescription ?? [
      LONG_DESCRIPTIONS[seed.number % LONG_DESCRIPTIONS.length] ?? '',
      LONG_DESCRIPTIONS[(seed.number + 1) % LONG_DESCRIPTIONS.length] ?? '',
      LONG_DESCRIPTIONS[(seed.number + 2) % LONG_DESCRIPTIONS.length] ?? '',
    ],
    tokenId: `#${pad(seed.number, 4)}`,
    creator,
    attributes,
    specs: {
      network: NETWORK_SPEC_TEXT[seed.network],
      royalty: `Royalties de ${String(royaltyBps / 100)}% nas vendas secundárias, pagos automaticamente pelos marketplaces compatíveis.`,
      contract: {
        address:
          seed.contractAddress ??
          (family === 'solana'
            ? solanaAddress(id)
            : evmAddress(
                pad(seed.number, 4)
                  .toUpperCase()
                  .replace(/[^0-9A-F]/g, '0'),
                'C0DE',
              )),
        standard: family === 'solana' ? 'SPL' : 'ERC-721',
      },
    },
    royaltyBps,
    editions: seed.editions,
    rating: seed.rating ?? Math.round((3.8 + prng.next() * 1.2) * 10) / 10,
    reviewCount,
    reviews: Array.from({ length: Math.min(3, reviewCount) }, (_, index) => ({
      id: `${id}-review-${String(index + 1)}`,
      author: REVIEW_AUTHORS[(seed.number + index) % REVIEW_AUTHORS.length] ?? 'Colecionador',
      rating: prng.int(4, 5),
      comment: REVIEW_COMMENTS[(seed.number + index) % REVIEW_COMMENTS.length] ?? '',
      createdAt: `2026-09-${pad(10 + index * 5, 2)}T14:00:00.000Z`,
    })),
  }
}

function gridTime(index: number): IsoDateTime {
  return `2026-09-30T${pad(23 - index, 2)}:00:00.000Z`
}

/** Hand-written NFTs that match Figma; tests use only these ids (never generated ones). */
function anchorSeeds(): Seed[] {
  const apes = collectionOf('kurio-apes')
  return [
    {
      name: 'Emerald Ape #042',
      number: 42,
      collection: apes,
      creatorIndex: 0,
      category: 'arte-digital',
      network: 'ethereum',
      artwork: 'ape-varsity',
      price: '1.19',
      rarity: 'rare',
      listedAt: gridTime(0),
      trendingScore: 88,
      editions: [
        edition('unique'),
        edition('limited-10', 3),
        edition('limited-50', 37),
        edition('open', null),
      ],
      attributes: ['Óculos', 'Esmeralda', 'Raro'],
      description:
        'Um colecionável digital finalizado à mão da coleção Kurio Editions, verificado na Ethereum, com arte desbloqueável e acesso para colecionadores.',
      longDescription: [
        'Emerald Ape #042 é uma das peças mais procuradas da coleção Kurio Apes: um macaco de óculos redondos e jaqueta universitária verde, desenhado à mão e finalizado digitalmente, camada por camada.',
        'Ao adquirir este NFT você recebe a arte em alta resolução, o certificado de autenticidade registrado na Ethereum e acesso à comunidade de colecionadores, com lançamentos antecipados e eventos exclusivos.',
        'A procedência é verificável a qualquer momento: o histórico de propriedade fica registrado na rede e os metadados são armazenados no IPFS, sem depender da plataforma.',
      ],
      rating: 4.8,
      reviewCount: 19,
      royaltyBps: 500,
      contractAddress: evmAddress('7A42', '19E8'),
    },
    {
      name: 'Sage Nomad #009',
      number: 9,
      collection: collectionOf('violet-nomads'),
      category: 'arte-3d',
      network: 'polygon',
      artwork: 'gorilla-bucket-hat',
      price: '1.69',
      rarity: 'common',
      listedAt: gridTime(1),
      trendingScore: 40,
      editions: [edition('limited-10', 6), edition('limited-50', 31), edition('open', null)],
    },
    {
      name: 'Neon Vessel #552',
      number: 552,
      collection: collectionOf('neon-relics'),
      category: 'arte-3d',
      network: 'solana',
      artwork: 'gorilla-turtleneck',
      price: '1.99',
      previousPrice: '2.29',
      rarity: 'rare',
      listedAt: gridTime(2),
      trendingScore: 72,
      editions: [edition('limited-10', 5), edition('open', null)],
    },
    {
      name: 'Cosmic Bloom #118',
      number: 118,
      collection: apes,
      category: 'colecionaveis',
      network: 'ethereum',
      artwork: 'gorilla-bucket-hat',
      price: '1.29',
      rarity: 'common',
      listedAt: gridTime(3),
      trendingScore: 35,
      editions: [edition('unique', 0), edition('limited-10', 6), edition('open', null)],
    },
    {
      name: 'Violet Nomad #314',
      number: 314,
      collection: apes,
      category: 'musica',
      network: 'polygon',
      artwork: 'gorilla-bucket-hat',
      price: '1.39',
      rarity: 'common',
      listedAt: gridTime(4),
      trendingScore: 52,
      editions: [edition('limited-10', 8), edition('limited-50', 1), edition('open', null)],
    },
    {
      name: 'Ivory Baron #088',
      number: 88,
      collection: apes,
      category: 'musica',
      network: 'ethereum',
      artwork: 'gorilla-turtleneck',
      price: '1.79',
      rarity: 'epic',
      listedAt: gridTime(5),
      trendingScore: 61,
      editions: [
        edition('unique'),
        edition('limited-10', 7),
        edition('limited-50', 22),
        edition('open', null),
      ],
    },
    {
      name: 'Golden Beat #207',
      number: 207,
      collection: apes,
      category: 'musica',
      network: 'solana',
      artwork: 'ape-headphones',
      price: '0.99',
      rarity: 'common',
      listedAt: gridTime(6),
      trendingScore: 75,
      editions: [edition('limited-10', 9), edition('limited-50', 24), edition('open', null)],
    },
    {
      name: 'Golden Frequency #071',
      number: 71,
      collection: collectionOf('golden-beats'),
      category: 'musica',
      network: 'polygon',
      artwork: 'ape-headphones',
      price: '0.59',
      rarity: 'common',
      listedAt: gridTime(7),
      trendingScore: 30,
      editions: [edition('limited-50', 18), edition('open', null)],
    },
    {
      name: 'Golden Signal #160',
      number: 160,
      collection: apes,
      category: 'musica',
      network: 'ethereum',
      artwork: 'ape-headphones',
      price: '0.39',
      rarity: 'rare',
      listedAt: gridTime(8),
      trendingScore: 66,
      editions: [edition('limited-10', 4), edition('open', null)],
    },
    {
      name: 'Obsidian Mask #007',
      number: 7,
      collection: collectionOf('ember-pilots'),
      category: 'colecionaveis',
      network: 'ethereum',
      artwork: 'gorilla-turtleneck',
      price: '3.40',
      rarity: 'legendary',
      listedAt: '2026-07-12T10:00:00.000Z',
      trendingScore: 58,
      editions: [edition('unique', 0), edition('limited-10', 0), edition('limited-50', 0)],
    },
    {
      name: 'Penny Pixel #001',
      number: 1,
      collection: collectionOf('cosmic-bloom'),
      category: 'jogos',
      network: 'solana',
      artwork: 'ape-varsity',
      price: '0.02',
      rarity: 'common',
      listedAt: '2026-08-02T10:00:00.000Z',
      trendingScore: 20,
      editions: [edition('open', null)],
    },
    {
      name: 'Crown Relic #999',
      number: 999,
      collection: collectionOf('neon-relics'),
      category: 'utilidade',
      network: 'ethereum',
      artwork: 'ape-headphones',
      price: '12.30',
      rarity: 'legendary',
      listedAt: '2026-06-20T10:00:00.000Z',
      trendingScore: 45,
      editions: [edition('unique'), edition('limited-10', 2)],
    },
  ]
}

function takeOut<T>(pool: T[], value: T): void {
  const index = pool.indexOf(value)
  if (index === -1) throw new Error(`Fixture quota exhausted for ${String(value)}`)
  pool.splice(index, 1)
}

function expand<K extends string>(counts: Record<K, number>): K[] {
  return (Object.entries(counts) as [K, number][]).flatMap(([key, count]) =>
    Array.from({ length: count }, () => key),
  )
}

type StockClass = 'soldout' | 'one-sold' | 'low' | 'normal'

const PATTERNS: Record<StockClass, EditionId[][]> = {
  soldout: [
    ['unique'],
    ['limited-10'],
    ['limited-50'],
    ['unique', 'limited-10'],
    ['limited-10', 'limited-50'],
  ],
  'one-sold': [
    ['unique', 'limited-10'],
    ['limited-10', 'open'],
    ['unique', 'open'],
    ['limited-10', 'limited-50', 'open'],
    ['unique', 'limited-10', 'limited-50', 'open'],
  ],
  low: [
    ['limited-10'],
    ['limited-10', 'open'],
    ['limited-50', 'open'],
    ['unique', 'limited-10', 'limited-50', 'open'],
  ],
  normal: [
    ['open'],
    ['unique', 'open'],
    ['limited-10', 'open'],
    ['limited-50'],
    ['unique', 'limited-10', 'limited-50', 'open'],
    ['limited-10', 'limited-50'],
    ['unique'],
    ['limited-10'],
  ],
}

function buildEditions(stock: StockClass, prng: Prng): EditionRecord[] {
  const ids = prng.pick(PATTERNS[stock])
  let soldOut = false
  let lowDone = false
  return ids.map((id) => {
    const def = EDITION_DEFS[id]
    if (def.supply === null) return edition(id, null)
    if (stock === 'soldout') return edition(id, 0)
    if (stock === 'one-sold' && !soldOut) {
      soldOut = true
      return edition(id, 0)
    }
    if (stock === 'low' && !lowDone && id !== 'unique') {
      lowDone = true
      return edition(id, prng.int(1, 2))
    }
    if (id === 'unique') return edition(id, 1)
    return edition(id, id === 'limited-10' ? prng.int(3, 10) : prng.int(8, 50))
  })
}

function generatedPrice(prng: Prng): Eth {
  // Skewed towards the low end, 0.03–12.20 ETH, mostly two decimals and sometimes four.
  const units = 300 + Math.floor(121_700 * prng.next() ** 2.5)
  return fromUnits(prng.chance(0.7) ? Math.max(300, Math.round(units / 100) * 100) : units)
}

function previousOf(price: Eth, prng: Prng): Eth {
  const [whole = '0', fraction = ''] = price.split('.')
  const units = Number(whole) * 10_000 + Number(fraction.padEnd(4, '0'))
  const factor = 110 + prng.int(0, 40)
  const rounded = Math.ceil((units * factor) / 100 / 100) * 100
  return fromUnits(Math.max(rounded, units + 100))
}

export function buildCatalog(): NftRecord[] {
  const prng = createPrng(PRNG_SEED)
  const anchors = anchorSeeds()
  const count = CATALOG_SIZE - anchors.length

  const categories = expand(CATEGORY_COUNTS)
  const networks = expand(NETWORK_COUNTS)
  for (const anchor of anchors) {
    takeOut(categories, anchor.category)
    takeOut(networks, anchor.network)
  }
  const categorySlots = prng.shuffle(categories)
  const networkSlots = prng.shuffle(networks)

  const anchorNew = anchors.filter((a) => a.listedAt >= '2026-09-01').length
  const anchorTrending = anchors.filter((a) => a.trendingScore >= 70).length
  const newSlots = prng.shuffle(
    Array.from({ length: count }, (_, i) => i < Math.round(CATALOG_SIZE * 0.25) - anchorNew),
  )
  const trendingSlots = prng.shuffle(
    Array.from({ length: count }, (_, i) => i < Math.round(CATALOG_SIZE * 0.2) - anchorTrending),
  )
  const stockSlots = prng.shuffle<StockClass>(
    Array.from({ length: count }, (_, i) =>
      i < 9 ? 'soldout' : i < 26 ? 'one-sold' : i < 37 ? 'low' : 'normal',
    ),
  )
  const saleSlots = prng.shuffle(Array.from({ length: count }, (_, i) => i < 16))

  const used = new Set(anchors.map((a) => a.number))
  const generated: Seed[] = []
  for (let i = 0; i < count; i++) {
    const collection = prng.pick(COLLECTIONS)
    let number = prng.int(2, 899)
    let name = ''
    for (;;) {
      name = `${prng.pick(collection.adjectives)} ${prng.pick(collection.nouns)} #${pad(number, 3)}`
      if (!used.has(number) && !generated.some((g) => slug(g.name) === slug(name))) break
      number = prng.int(2, 899)
    }
    used.add(number)
    const category = categorySlots[i]
    const network = networkSlots[i]
    if (!category || !network) throw new Error('Fixture slots out of sync')
    const price = generatedPrice(prng)
    const rarityRoll = prng.next()
    const isNew = newSlots[i] === true
    const day = isNew ? prng.int(1, 29) : prng.int(0, 91)
    const listedAt: IsoDateTime = isNew
      ? `2026-09-${pad(day, 2)}T${pad(prng.int(0, 23), 2)}:00:00.000Z`
      : new Date(Date.UTC(2026, 5, 1 + day, prng.int(0, 23))).toISOString()
    generated.push({
      name,
      number,
      collection,
      category,
      network,
      artwork: prng.pick(ARTWORK_KEYS),
      price,
      ...(saleSlots[i] === true && { previousPrice: previousOf(price, prng) }),
      rarity:
        rarityRoll < 0.6
          ? 'common'
          : rarityRoll < 0.85
            ? 'rare'
            : rarityRoll < 0.95
              ? 'epic'
              : 'legendary',
      listedAt,
      trendingScore: trendingSlots[i] === true ? prng.int(70, 99) : prng.int(5, 69),
      editions: buildEditions(stockSlots[i] ?? 'normal', prng),
    })
  }

  return [...anchors, ...generated].map((seed) => toRecord(seed, prng))
}
