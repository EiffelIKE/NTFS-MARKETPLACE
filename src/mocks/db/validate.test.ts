import { describe, expect, it } from 'vitest'

import { seed } from './seed'
import { SCHEMA_VERSION, type SeedId } from './state'
import { validateState } from './validate'

const SEEDS: SeedId[] = ['default', 'empty-catalog', 'pending-order']

type Json = Record<string, unknown>

function clone(): Json {
  return JSON.parse(JSON.stringify(seed())) as Json
}

describe('validateState (spec 13, SW boot recovery)', () => {
  it.each(SEEDS)('accepts the %s seed after a JSON round trip', (id) => {
    expect(validateState(JSON.parse(JSON.stringify(seed(id))))).toBeNull()
  })

  it.each([
    ['null', null],
    ['an array', []],
    ['a number', 42],
    ['an unknown schema version', { schemaVersion: SCHEMA_VERSION + 1 }],
    ['a bare schema version', { schemaVersion: SCHEMA_VERSION }],
  ])('rejects %s', (_name, value) => {
    expect(validateState(value)).not.toBeNull()
  })

  it.each([
    [
      'nfts',
      (s: Json) => {
        delete s.nfts
      },
    ],
    [
      'highlights',
      (s: Json) => {
        delete s.highlights
      },
    ],
    [
      'orders',
      (s: Json) => {
        s.orders = []
      },
    ],
    [
      'carts',
      (s: Json) => {
        s.carts = null
      },
    ],
    [
      'seq',
      (s: Json) => {
        s.seq = { user: 1 }
      },
    ],
    [
      'triggers',
      (s: Json) => {
        delete s.triggers
      },
    ],
    [
      'favorites',
      (s: Json) => {
        s.favorites = { u: 'x' }
      },
    ],
  ])('rejects a database with a damaged %s', (name, damage) => {
    const state = clone()
    damage(state)
    expect(validateState(state)).toContain(name)
  })

  it('rejects a catalog row cut short', () => {
    const state = clone()
    const nfts = state.nfts as Record<string, Json>
    const [first] = Object.values(nfts)
    if (first === undefined) throw new Error('seed has no NFT')
    delete first.editions
    expect(validateState(state)).toContain('editions')
  })
})
