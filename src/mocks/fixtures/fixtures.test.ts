import { readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { CATEGORY_LABELS, NetworkId, NftDetail, NftSummary } from '@/contracts'
import { eth } from '@/lib/money'
import { must } from '@/lib/test-utils'

import { seed } from '../db/seed'
import { toNftDetail, toNftSummary } from '../domain/mappers'
import { queryCatalog } from '../domain/catalog-query'
import { verifyPassword } from '../lib/crypto'
import { ARTWORK_KEYS, ARTWORK_WIDTHS } from './artworks'
import { COUPONS } from './coupons'
import { CREDENTIALS } from './credentials'
import { USERS } from './users'

const state = seed('default')
const nfts = Object.values(state.nfts)

describe('seed', () => {
  it('is deterministic', () => {
    expect(seed('default')).toEqual(seed('default'))
    expect(seed('pending-order')).toEqual(seed('pending-order'))
  })

  it('has 120 NFTs with unique ids that satisfy the wire contract', () => {
    expect(nfts).toHaveLength(120)
    expect(new Set(nfts.map((nft) => nft.id)).size).toBe(120)
    for (const nft of nfts) {
      expect(NftSummary.safeParse(toNftSummary(nft)).success, nft.id).toBe(true)
      expect(NftDetail.safeParse(toNftDetail(nft)).success, nft.id).toBe(true)
    }
  })

  it('covers every category and network with the planned counts', () => {
    const categories = Object.fromEntries(
      Object.keys(CATEGORY_LABELS).map((id) => [id, nfts.filter((n) => n.category === id).length]),
    )
    expect(categories).toEqual({
      'arte-digital': 17,
      fotografia: 6,
      musica: 33,
      'arte-3d': 19,
      colecionaveis: 12,
      generativa: 8,
      jogos: 10,
      assinaturas: 6,
      utilidade: 9,
    })
    for (const [network, count] of [
      ['ethereum', 50],
      ['polygon', 33],
      ['solana', 37],
    ] as const) {
      expect(nfts.filter((n) => n.network === NetworkId.parse(network))).toHaveLength(count)
    }
  })

  it('spans the Figma price range with at most 4 decimals', () => {
    const prices = nfts.map((n) => n.price)
    expect(prices.reduce((a, b) => (eth.cmp(a, b) <= 0 ? a : b))).toBe('0.02')
    expect(prices.reduce((a, b) => (eth.cmp(a, b) >= 0 ? a : b))).toBe('12.3')
    for (const price of prices) expect(price.split('.')[1]?.length ?? 0).toBeLessThanOrEqual(4)
    for (const nft of nfts) {
      if (nft.previousPrice !== undefined) expect(eth.cmp(nft.previousPrice, nft.price)).toBe(1)
    }
  })

  it('has sold-out, low-stock, new and trending NFTs', () => {
    const soldOut = nfts.filter((n) => n.editions.every((e) => e.available === 0))
    const oneSold = nfts.filter(
      (n) => n.editions.some((e) => e.available === 0) && n.editions.some((e) => e.available !== 0),
    )
    const low = nfts.filter((n) =>
      n.editions.some((e) => e.available !== null && e.available > 0 && e.available <= 2),
    )
    expect(soldOut.length).toBeGreaterThanOrEqual(8)
    expect(oneSold.length).toBeGreaterThanOrEqual(10)
    expect(low.length).toBeGreaterThanOrEqual(8)
    expect(nfts.filter((n) => n.trendingScore >= 70)).toHaveLength(24)
    expect(nfts.filter((n) => n.listedAt >= '2026-09-01')).toHaveLength(30)
    expect(nfts.filter((n) => n.previousPrice !== undefined).length).toBeGreaterThanOrEqual(12)
  })

  it('lists the nine Figma grid anchors first on the default home page', () => {
    const page = queryCatalog(nfts, { segment: 'all', sort: 'recent', page: 1, pageSize: 9 }, null)
    expect(page.items.map((item) => item.id)).toEqual([
      'emerald-ape-042',
      'sage-nomad-009',
      'neon-vessel-552',
      'cosmic-bloom-118',
      'violet-nomad-314',
      'ivory-baron-088',
      'golden-beat-207',
      'golden-frequency-071',
      'golden-signal-160',
    ])
    expect(page.items.map((item) => item.price)).toEqual([
      '1.19',
      '1.69',
      '1.99',
      '1.29',
      '1.39',
      '1.79',
      '0.99',
      '0.59',
      '0.39',
    ])
    expect(page.items[2]?.previousPrice).toBe('2.29')
  })

  it('matches the Emerald Ape anchor from Figma', () => {
    const detail = toNftDetail(must(state.nfts['emerald-ape-042']))
    expect(detail).toMatchObject({
      name: 'Emerald Ape #042',
      price: '1.19',
      tokenId: '#0042',
      collection: { name: 'Kurio Apes' },
      creator: { name: 'Nova Sato' },
      attributes: ['Óculos', 'Esmeralda', 'Raro'],
      rating: 4.8,
      reviewCount: 19,
      royaltyBps: 500,
    })
    expect(detail.specs.contract.address).toMatch(/^0x7A42[0-9a-fA-F]{32}19E8$/)
    expect(detail.editions.map((e) => [e.label, e.available])).toEqual([
      ['1/1', 1],
      ['1/10', 3],
      ['1/50', 37],
      ['ABERTA', null],
    ])
  })

  it('has the edge-case anchors', () => {
    const editions = (id: string) => state.nfts[id]?.editions
    expect(editions('cosmic-bloom-118')?.find((e) => e.id === 'unique')?.available).toBe(0)
    expect(editions('violet-nomad-314')?.find((e) => e.id === 'limited-50')?.available).toBe(1)
    expect(editions('obsidian-mask-007')?.every((e) => e.available === 0)).toBe(true)
    expect(state.nfts['penny-pixel-001']?.price).toBe('0.02')
    expect(state.nfts['crown-relic-999']?.price).toBe('12.3')
  })

  it('has the pending-order seed hold its reservation', () => {
    const pending = seed('pending-order')
    expect(pending.orders.ord_000002?.status).toBe('pending')
    const edition = pending.nfts['cosmic-bloom-118']?.editions.find((e) => e.id === 'limited-10')
    expect(edition?.available).toBe(5)
  })

  it('empties the catalog but keeps users and wallets', () => {
    const empty = seed('empty-catalog')
    expect(Object.keys(empty.nfts)).toHaveLength(0)
    expect(empty.highlights.hero).toHaveLength(0)
    expect(Object.keys(empty.carts)).toHaveLength(0)
    expect(Object.keys(empty.favorites)).toHaveLength(0)
    expect(Object.keys(empty.users)).toHaveLength(3)
    expect(Object.keys(empty.wallets)).toHaveLength(3)
  })
})

describe('users', () => {
  it('has at least two users with distinct data', () => {
    expect(USERS.length).toBeGreaterThanOrEqual(2)
    expect(state.favorites.usr_ana).toContain('emerald-ape-042')
    expect(state.favorites.usr_carla).toHaveLength(2)
    expect(state.carts['user:usr_ana']?.items).toHaveLength(2)
    expect(state.orders.ord_000001?.status).toBe('confirmed')
  })

  it.each(Object.entries(CREDENTIALS))(
    'stores only a verifiable hash for %s',
    async (_name, creds) => {
      const user = must(state.users[creds.id])
      expect(user.email).toBe(creds.email)
      expect(user.passwordHash).toMatch(/^pbkdf2-sha256\$100000\$/)
      expect(user.passwordHash).not.toContain(creds.password)
      expect(await verifyPassword(creds.password, user.passwordHash)).toBe(true)
      expect(await verifyPassword('wrong-password1', user.passwordHash)).toBe(false)
    },
  )

  it('names the seeded users by the same ids the credentials carry (G4)', () => {
    expect(Object.keys(state.favorites).sort()).toEqual([CREDENTIALS.ana.id, CREDENTIALS.carla.id])
  })

  it('keeps the plaintext passwords out of the app graph: only tests and the e2e helpers import them (G4)', () => {
    const importers: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = resolve(dir, name)
        if (statSync(path).isDirectory()) walk(path)
        else if (
          /\.tsx?$/.test(name) &&
          readFileSync(path, 'utf8').includes("fixtures/credentials'")
        ) {
          importers.push(path.replace(`${resolve(import.meta.dirname, '../..')}/`, ''))
        }
      }
    }
    walk(resolve(import.meta.dirname, '../..'))
    const inApp = importers.filter(
      (path) => !/\.test\.tsx?$/.test(path) && !path.endsWith('api/contract-kit.ts'),
    )
    expect(inApp).toEqual([])
  })

  it('never serializes a plaintext password into the seed', () => {
    const text = JSON.stringify(state)
    for (const { password } of Object.values(CREDENTIALS)) expect(text).not.toContain(password)
  })
})

describe('artworks', () => {
  const root = resolve(import.meta.dirname, '../../assets/NFTs')

  /** Canvas width of a WebP file (VP8X stores width − 1 in 24 bits). */
  function webpWidth(file: string): number {
    const buffer = readFileSync(file)
    expect(buffer.toString('ascii', 0, 4)).toBe('RIFF')
    expect(buffer.toString('ascii', 8, 12)).toBe('WEBP')
    const chunk = buffer.toString('ascii', 12, 16)
    if (chunk === 'VP8X') return buffer.readUIntLE(24, 3) + 1
    if (chunk === 'VP8 ') return buffer.readUInt16LE(26) & 0x3fff
    return (buffer.readUInt16LE(21) & 0x3fff) + 1
  }

  it.each(ARTWORK_KEYS.flatMap((key) => ARTWORK_WIDTHS.map((width) => [key, width] as const)))(
    '%s exists at width %i with that pixel width',
    (key, width) => {
      expect(webpWidth(resolve(root, String(width), `${key}.webp`))).toBe(width)
    },
  )
})

describe('coupons (R11)', () => {
  const at = (code: string) => Date.parse(must(COUPONS.find((c) => c.code === code)).expiresAt)

  it('keeps the valid ones valid and the expired one expired for any plausible clock', () => {
    const early = Date.parse('2026-04-01T00:00:00Z')
    const late = Date.parse('2060-01-01T00:00:00Z')
    expect(at('KURIO10')).toBeGreaterThan(late)
    expect(at('COLECAO05')).toBeGreaterThan(late)
    expect(at('VERAO25')).toBeLessThan(early)
  })
})
