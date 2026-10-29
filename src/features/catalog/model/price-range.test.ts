import { describe, expect, it } from 'vitest'

import {
  boundsFromFacets,
  fromSteps,
  pricesFromRange,
  rangeFromSearch,
  toSteps,
} from './price-range'

describe('price steps (CAT-09)', () => {
  it('converts ETH strings to hundredths and back', () => {
    expect(toSteps('0.02')).toBe(2)
    expect(toSteps('12.30')).toBe(1230)
    expect(toSteps('12.3')).toBe(1230)
    expect(toSteps('0')).toBe(0)
    expect(fromSteps(2)).toBe('0.02')
    expect(fromSteps(1230)).toBe('12.30')
    expect(fromSteps(5)).toBe('0.05')
    expect(fromSteps(100)).toBe('1.00')
  })

  it('rounds a finer fraction down or up, without float math', () => {
    expect(toSteps('1.2345', 'floor')).toBe(123)
    expect(toSteps('1.2345', 'ceil')).toBe(124)
    expect(toSteps('1.23', 'ceil')).toBe(123)
    // 0.1 + 0.2 and 1.15 * 100 are the classic float traps.
    expect(toSteps('1.15', 'floor')).toBe(115)
    expect(toSteps('0.29', 'ceil')).toBe(29)
    expect(toSteps('0.57', 'floor')).toBe(57)
  })

  it('round-trips every step of a range exactly', () => {
    for (let steps = 0; steps <= 2000; steps++) {
      expect(toSteps(fromSteps(steps))).toBe(steps)
    }
  })
})

describe('bounds from the facets', () => {
  it('floors the minimum and ceils the maximum', () => {
    expect(boundsFromFacets({ min: '0.0200', max: '12.2999' })).toEqual({ min: 2, max: 1230 })
    expect(boundsFromFacets({ min: '1.2345', max: '1.5' })).toEqual({ min: 123, max: 150 })
  })

  it('has no bounds without prices or with a single step', () => {
    expect(boundsFromFacets(null)).toBeNull()
    expect(boundsFromFacets({ min: '1.5', max: '1.5' })).toBeNull()
  })
})

describe('range <-> URL prices', () => {
  const bounds = { min: 2, max: 1230 }

  it('starts at the bounds and clamps prices outside them', () => {
    expect(rangeFromSearch(bounds, undefined, undefined)).toEqual([2, 1230])
    expect(rangeFromSearch(bounds, '0.5', '3')).toEqual([50, 300])
    expect(rangeFromSearch(bounds, '0.001', '99')).toEqual([2, 1230])
  })

  it('writes a price only for an end that moved off its bound', () => {
    expect(pricesFromRange(bounds, [2, 1230])).toEqual({ minPrice: undefined, maxPrice: undefined })
    expect(pricesFromRange(bounds, [50, 1230])).toEqual({ minPrice: '0.50', maxPrice: undefined })
    expect(pricesFromRange(bounds, [2, 300])).toEqual({ minPrice: undefined, maxPrice: '3.00' })
  })
})
