import { describe, expect, it } from 'vitest'

import type { Cart, Edition, NftDetail } from '@/contracts'

import {
  addableMax,
  clampQuantity,
  defaultEditionId,
  diffNft,
  editionCaption,
  inCartQuantity,
  lineLimit,
} from './purchase'

const unique: Edition = { id: 'unique', label: '1/1', supply: 1, available: 1, maxPerOrder: 1 }
const limited10: Edition = {
  id: 'limited-10',
  label: '1/10',
  supply: 10,
  available: 3,
  maxPerOrder: 3,
}
const limited50: Edition = {
  id: 'limited-50',
  label: '1/50',
  supply: 50,
  available: 37,
  maxPerOrder: 5,
}
const open: Edition = {
  id: 'open',
  label: 'ABERTA',
  supply: null,
  available: null,
  maxPerOrder: 10,
}
const soldOut = (edition: Edition): Edition => ({ ...edition, available: 0 })

describe('lineLimit (DET-14)', () => {
  it('is the smaller of what remains and the per-order limit; an open edition has no stock bound', () => {
    expect(lineLimit(unique)).toBe(1)
    expect(lineLimit(limited10)).toBe(3)
    expect(lineLimit({ ...limited10, available: 2 })).toBe(2)
    expect(lineLimit(limited50)).toBe(5)
    expect(lineLimit(open)).toBe(10)
    expect(lineLimit(soldOut(limited10))).toBe(0)
  })
})

describe('addableMax (DET-14)', () => {
  it('subtracts what the cart already holds and never goes below zero', () => {
    expect(addableMax(open, 0)).toBe(10)
    expect(addableMax(open, 1)).toBe(9)
    expect(addableMax(limited10, 3)).toBe(0)
    expect(addableMax(limited10, 5)).toBe(0)
  })
})

describe('inCartQuantity', () => {
  const cart = {
    items: [
      { nftId: 'a-nft', editionId: 'open', quantity: 2 },
      { nftId: 'a-nft', editionId: 'limited-10', quantity: 1 },
      { nftId: 'b-nft', editionId: 'open', quantity: 4 },
    ],
  } as unknown as Cart

  it('counts one edition of one NFT, and zero without a cart', () => {
    expect(inCartQuantity(cart, 'a-nft', 'open')).toBe(2)
    expect(inCartQuantity(cart, 'a-nft', 'unique')).toBe(0)
    expect(inCartQuantity(undefined, 'a-nft', 'open')).toBe(0)
  })
})

describe('defaultEditionId (DET-11)', () => {
  const editions = [unique, limited10, limited50, open]

  it('takes the requested edition when it has stock', () => {
    expect(defaultEditionId(editions, 'limited-50')).toBe('limited-50')
    expect(defaultEditionId(editions, 'open')).toBe('open')
  })

  it('falls back to the first edition with stock when the request is sold out, unknown or missing', () => {
    expect(defaultEditionId([soldOut(unique), limited10, open], 'unique')).toBe('limited-10')
    expect(defaultEditionId([limited10, open], 'unique')).toBe('limited-10')
    expect(defaultEditionId([soldOut(unique), limited10, open])).toBe('limited-10')
  })

  it('is null when every edition is sold out', () => {
    expect(defaultEditionId([soldOut(unique), soldOut(limited10)], 'unique')).toBeNull()
  })
})

describe('clampQuantity (DET-14)', () => {
  it('keeps the quantity inside 1..max, and at 1 when nothing can be added', () => {
    expect(clampQuantity(3, 9)).toBe(3)
    expect(clampQuantity(12, 9)).toBe(9)
    expect(clampQuantity(0, 9)).toBe(1)
    expect(clampQuantity(4, 0)).toBe(1)
  })
})

describe('diffNft (DET-24)', () => {
  const nft = (patch: Partial<NftDetail> = {}, editions = [limited10, open]) =>
    ({ price: '1.19', editions, ...patch }) as unknown as NftDetail

  it('reports a new price, comparing amounts rather than strings', () => {
    expect(diffNft(nft(), nft({ price: '1.25' }), 'open')).toEqual({ priceChanged: '1.25' })
    expect(diffNft(nft(), nft({ price: '1.190' }), 'open')).toEqual({})
  })

  it('reports that the selected edition sold out, and only that edition', () => {
    const after = nft({}, [soldOut(limited10), open])
    expect(diffNft(nft(), after, 'limited-10')).toEqual({ selectedSoldOut: true })
    expect(diffNft(nft(), after, 'open')).toEqual({})
    expect(diffNft(nft(), after, null)).toEqual({})
    // Already sold out before: nothing new.
    expect(diffNft(after, after, 'limited-10')).toEqual({})
  })
})

describe('editionCaption (DET-13)', () => {
  it('describes limited, open, unique and sold-out editions, with the cart notice', () => {
    expect(editionCaption(limited10, 0)).toBe('3 de 10 disponíveis · máx. 3 por pedido')
    expect(editionCaption(open, 0)).toBe('Edição aberta · máx. 10 por pedido')
    expect(editionCaption(open, 1)).toBe(
      'Edição aberta · máx. 10 por pedido · você já tem 1 no carrinho',
    )
    expect(editionCaption(unique, 0)).toBe('Edição única · máx. 1 por pedido')
    expect(editionCaption(soldOut(limited10), 0)).toBe('Esgotada')
  })
})
