import { describe, expect, expectTypeOf, it } from 'vitest'

import {
  CreateWalletBody,
  ERROR_DEFAULTS,
  ErrorEnvelope,
  Eth,
  NftListQuery,
  NftListWireQuery,
  OPERATIONS,
  Quantity,
  WireErrorCode,
  addressFamily,
  addressMatchesNetwork,
  errorDetails,
  networkFamily,
  toWireQuery,
  type ApiErrorCode,
  type NftDetail,
  type NftSummary,
  type Order,
  type Quote,
} from './index'

describe('Eth', () => {
  it.each(['0', '1', '0.5', '12.30', '0.000000000000000001', '1234567.1'])(
    'accepts %s',
    (value) => {
      expect(Eth.safeParse(value).success).toBe(true)
    },
  )

  it.each(['', '-1', '01', '.5', '1.', '1e3', '0.0000000000000000001', ' 1', '1,5'])(
    'rejects %j',
    (value) => {
      expect(Eth.safeParse(value).success).toBe(false)
    },
  )

  it('rejects numbers: amounts are strings on the wire', () => {
    expect(Eth.safeParse(1.5).success).toBe(false)
  })
})

describe('Quantity', () => {
  it('accepts integers from 1 to 99', () => {
    expect([1, 50, 99].map((n) => Quantity.safeParse(n).success)).toEqual([true, true, true])
  })

  it.each([0, 100, 1.5, -1, '2'])('rejects %j', (value) => {
    expect(Quantity.safeParse(value).success).toBe(false)
  })
})

describe('NftListQuery', () => {
  it('applies defaults', () => {
    expect(NftListQuery.parse({})).toEqual({ segment: 'all', sort: 'recent', page: 1, pageSize: 9 })
  })

  it('rejects minPrice above maxPrice on the minPrice field', () => {
    const result = NftListQuery.safeParse({ minPrice: '2', maxPrice: '1.5' })
    expect(result.error?.issues[0]?.path).toEqual(['minPrice'])
  })

  it('compares prices as decimals, not as text', () => {
    expect(NftListQuery.safeParse({ minPrice: '9', maxPrice: '10' }).success).toBe(true)
  })

  it('bounds pageSize', () => {
    expect(NftListQuery.safeParse({ pageSize: 49 }).success).toBe(false)
    expect(NftListQuery.safeParse({ pageSize: 0 }).success).toBe(false)
  })
})

describe('wire query', () => {
  it('round-trips through toWireQuery and NftListWireQuery', () => {
    const query = NftListQuery.parse({
      q: ' ape ',
      categories: ['musica', 'arte-3d'],
      networks: ['solana'],
      minPrice: '0.1',
      maxPrice: '2',
      sort: 'price-asc',
      favorites: true,
      page: 2,
    })
    const wire = toWireQuery(query)
    expect(wire).toMatchObject({
      q: 'ape',
      categories: 'musica,arte-3d',
      page: '2',
      favorites: 'true',
    })
    expect(NftListWireQuery.parse(wire)).toEqual({ ...query, q: 'ape' })
  })

  it('drops empty and undefined values', () => {
    expect(toWireQuery({ q: '  ', categories: [], minPrice: undefined })).toEqual({})
  })

  it('does not accept favorites=false (the filter is on or absent)', () => {
    expect(NftListWireQuery.safeParse({ favorites: 'false' }).success).toBe(false)
  })
})

describe('error contract', () => {
  it('has a status and a pt-BR message for every wire code', () => {
    for (const code of WireErrorCode.options) {
      expect(ERROR_DEFAULTS[code].status, code).toBeGreaterThanOrEqual(400)
      expect(ERROR_DEFAULTS[code].message, code).toMatch(/\S/)
    }
  })

  it('keeps UNKNOWN out of the wire codes (it only exists on the client)', () => {
    expect(WireErrorCode.safeParse('UNKNOWN').success).toBe(false)
    expectTypeOf<ApiErrorCode>().toEqualTypeOf<WireErrorCode | 'UNKNOWN'>()
  })

  it('knows which codes carry details', () => {
    expect(errorDetails('QUOTE_CHANGED')).toBeDefined()
    expect(errorDetails('UNAUTHENTICATED')).toBeUndefined()
    expect(errorDetails('NOT_FOUND')?.safeParse({ resource: 'nft' }).success).toBe(true)
    expect(errorDetails('NOT_FOUND')?.safeParse({}).success).toBe(false)
  })

  it('validates the envelope', () => {
    expect(ErrorEnvelope.safeParse({ error: { code: 'NOT_FOUND', message: 'x' } }).success).toBe(
      true,
    )
    expect(ErrorEnvelope.safeParse({ error: { code: 'WAT', message: 'x' } }).success).toBe(false)
    expect(ErrorEnvelope.safeParse({ message: 'x' }).success).toBe(false)
  })
})

describe('operations table', () => {
  it('lists unique method and path pairs', () => {
    const keys = Object.values(OPERATIONS).map((op) => `${op.method} ${op.path}`)
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys).toHaveLength(35)
  })

  it('keeps ids and paths well formed', () => {
    for (const [id, op] of Object.entries(OPERATIONS)) {
      expect(id, id).toMatch(/^[a-zA-Z]+\.[a-zA-Z]+$/)
      expect(op.path, id).toMatch(/^\/[a-z0-9/:-]*$/i)
    }
  })

  it('marks the auth mode of representative operations', () => {
    expect(OPERATIONS['auth.login'].auth).toBe('none')
    expect(OPERATIONS['nfts.list'].auth).toBe('optional')
    expect(OPERATIONS['cart.get'].auth).toBe('cart')
    expect(OPERATIONS['orders.create'].auth).toBe('required')
  })
})

describe('wallet addresses', () => {
  const evm = '0xC4A1000000000000000000000000000000D00D00'
  const solana = 'Fq3Zq7mVd2kRrYxJt8hGnWb5LcPsA9UeXoT4yNvKiD6B'

  it('derives the address family', () => {
    expect(addressFamily(evm)).toBe('evm')
    expect(addressFamily(solana)).toBe('solana')
    expect(addressFamily('0x123')).toBeNull()
    expect(addressFamily('')).toBeNull()
  })

  it('maps networks to families', () => {
    expect(networkFamily('ethereum')).toBe('evm')
    expect(networkFamily('polygon')).toBe('evm')
    expect(networkFamily('solana')).toBe('solana')
  })

  it('matches an address with its network family only', () => {
    expect(addressMatchesNetwork(evm, 'polygon')).toBe(true)
    expect(addressMatchesNetwork(evm, 'solana')).toBe(false)
    expect(addressMatchesNetwork(solana, 'solana')).toBe(true)
    expect(addressMatchesNetwork(solana, 'ethereum')).toBe(false)
  })

  it('reports a mismatch on the address field of a wallet body', () => {
    const body = {
      role: 'primary',
      displayName: 'Carla Mendes',
      nickname: 'Carteira',
      network: 'solana',
      profileName: 'Carla M.',
      address: evm,
      provider: 'metamask',
      referralCode: 'CARLA-01',
      email: 'carla@kurio.example',
      ensName: 'carla',
    }
    const result = CreateWalletBody.safeParse(body)
    expect(result.error?.issues.map((i) => i.path.join('.'))).toEqual(['address'])
    expect(CreateWalletBody.safeParse({ ...body, network: 'ethereum' }).success).toBe(true)
  })
})

describe('inferred types', () => {
  it('keeps amounts as strings and quantities as numbers', () => {
    expectTypeOf<NftSummary['price']>().toBeString()
    expectTypeOf<NftDetail['price']>().toBeString()
    expectTypeOf<Quote['total']>().toBeString()
    expectTypeOf<Quote['lines'][number]['quantity']>().toBeNumber()
    expectTypeOf<Order['lines'][number]['quantity']>().toBeNumber()
  })
})
