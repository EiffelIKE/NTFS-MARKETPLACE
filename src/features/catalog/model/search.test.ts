import { describe, expect, it } from 'vitest'

import {
  CLEARED,
  activeFilterCount,
  catalogSearch,
  isDefaultState,
  toListQuery,
  toggleInList,
  withChange,
  withPage,
} from './search'

const parse = (raw: unknown) => catalogSearch.parse(raw)

describe('catalogSearch (CAT-01, CAT-02)', () => {
  it('omits every default', () => {
    expect(parse({})).toEqual({})
    expect(parse({ page: '1', segment: 'all', sort: 'recent', q: '  ' })).toEqual({})
  })

  it('keeps valid values, coerced from the strings the URL holds', () => {
    expect(
      parse({
        q: ' ape ',
        categories: 'musica,arte-3d',
        networks: 'polygon',
        minPrice: '0.20',
        maxPrice: '5',
        segment: 'trending',
        sort: 'price-asc',
        page: '3',
        favorites: '1',
      }),
    ).toEqual({
      q: 'ape',
      categories: 'arte-3d,musica',
      networks: 'polygon',
      minPrice: '0.2',
      maxPrice: '5',
      segment: 'trending',
      sort: 'price-asc',
      page: 3,
      favorites: 1,
    })
  })

  it('drops malformed and unknown values instead of failing', () => {
    expect(
      parse({ page: 'abc', sort: 'foo', categories: 'nope', segment: 'x', minPrice: 'a' }),
    ).toEqual({})
    expect(parse({ page: '2.5' })).toEqual({})
    expect(parse({ page: '0' })).toEqual({})
    expect(parse({ page: '-4' })).toEqual({})
    expect(parse({ favorites: '2' })).toEqual({})
    expect(parse({ unknown: 'x' })).toEqual({})
  })

  it('keeps a dropped key as undefined, so the router cannot keep its raw URL value', () => {
    const parsed = parse({ sort: 'foo', page: 'abc', unknown: 'x' })
    expect(Object.keys(parsed).sort()).toEqual(['page', 'sort'])
    expect(parsed.sort).toBeUndefined()
    expect(parsed.page).toBeUndefined()
  })

  it('keeps the valid ids of a list, sorted and without duplicates', () => {
    expect(parse({ categories: 'nope,musica' })).toEqual({ categories: 'musica' })
    expect(parse({ categories: 'musica,arte-3d,musica' })).toEqual({ categories: 'arte-3d,musica' })
    expect(parse({ networks: 'solana,ethereum' })).toEqual({ networks: 'ethereum,solana' })
  })

  it('reads numbers the router may hand over', () => {
    expect(parse({ page: 2, favorites: 1, q: 123, minPrice: 0.5 })).toEqual({
      page: 2,
      favorites: 1,
      q: '123',
      minPrice: '0.5',
    })
  })

  it('drops both prices when min is above max', () => {
    expect(parse({ minPrice: '2', maxPrice: '1', q: 'ape' })).toEqual({ q: 'ape' })
    expect(parse({ minPrice: '1', maxPrice: '1' })).toEqual({ minPrice: '1', maxPrice: '1' })
  })

  it('drops a search term over 80 characters', () => {
    expect(parse({ q: 'a'.repeat(81) })).toEqual({})
    expect(parse({ q: 'a'.repeat(80) })).toEqual({ q: 'a'.repeat(80) })
  })
})

describe('withChange / withPage (CAT-04)', () => {
  const prev = parse({ categories: 'musica', sort: 'popular', page: '4' })

  it('clears the page on every change and keeps the rest', () => {
    expect(withChange(prev, { networks: 'polygon' })).toEqual({
      categories: 'musica',
      sort: 'popular',
      networks: 'polygon',
    })
    expect(withChange(prev, { segment: 'new' }).page).toBeUndefined()
    expect(withChange(prev, { q: 'ape' }).page).toBeUndefined()
  })

  it('clears a param with undefined', () => {
    expect(withChange(prev, { categories: undefined })).toEqual({ sort: 'popular' })
  })

  it('changes only the page, and page 1 is no param', () => {
    expect(withPage(prev, 5)).toEqual({ categories: 'musica', sort: 'popular', page: 5 })
    expect(withPage(prev, 1)).toEqual({ categories: 'musica', sort: 'popular' })
  })

  it('has a cleared state that is the default', () => {
    expect(isDefaultState(CLEARED)).toBe(true)
  })
})

describe('lists and counters', () => {
  it('toggles an id in a selection', () => {
    expect(toggleInList(undefined, 'musica')).toBe('musica')
    expect(toggleInList('musica', 'arte-3d')).toBe('musica,arte-3d')
    expect(toggleInList('musica,arte-3d', 'musica')).toBe('arte-3d')
    expect(toggleInList('musica', 'musica')).toBeUndefined()
  })

  it('counts only filters, not page, sort or search', () => {
    expect(isDefaultState(parse({ page: '2', sort: 'popular' }))).toBe(true)
    expect(isDefaultState(parse({ q: 'ape' }))).toBe(false)
    expect(isDefaultState(parse({ favorites: '1' }))).toBe(false)
    expect(activeFilterCount(parse({ categories: 'musica,arte-3d', networks: 'polygon' }))).toBe(3)
    expect(activeFilterCount(parse({ minPrice: '1', q: 'ape' }))).toBe(1)
  })
})

describe('toListQuery (CAT-06)', () => {
  it('fills the defaults and the page size', () => {
    expect(toListQuery({})).toEqual({ segment: 'all', sort: 'recent', page: 1, pageSize: 9 })
  })

  it('splits the lists and keeps every param', () => {
    expect(
      toListQuery(
        parse({
          q: 'ape',
          categories: 'musica,arte-3d',
          networks: 'polygon',
          minPrice: '0.5',
          maxPrice: '3',
          segment: 'new',
          sort: 'price-desc',
          page: '2',
          favorites: '1',
        }),
      ),
    ).toEqual({
      q: 'ape',
      categories: ['arte-3d', 'musica'],
      networks: ['polygon'],
      minPrice: '0.5',
      maxPrice: '3',
      segment: 'new',
      sort: 'price-desc',
      favorites: true,
      page: 2,
      pageSize: 9,
    })
  })

  it('gives an equal object for the same state however it was spelled', () => {
    const a = toListQuery(parse({ categories: 'musica,arte-3d', page: '1', sort: 'recent' }))
    const b = toListQuery(parse({ sort: 'recent', categories: 'arte-3d,musica,musica' }))
    expect(a).toEqual(b)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
})
