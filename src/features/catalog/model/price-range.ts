import type { Eth, Facets } from '@/contracts'
import { eth } from '@/lib/money'

// The slider works in whole hundredths of an ETH (0.01 steps), so no float touches a price
// (spec 05 design §6). `Eth` strings stay the only way a price crosses a boundary.

export interface PriceBounds {
  /** Smallest step: the facets' minimum rounded down. */
  min: number
  /** Largest step: the facets' maximum rounded up. */
  max: number
}

/** `"0.02"` to 2, rounding down (`floor`) or up (`ceil`) when the amount has a finer fraction. */
export function toSteps(value: Eth, rounding: 'floor' | 'ceil' = 'floor'): number {
  const scaled = eth.times(value, 100)
  const floor = Number(eth.round(scaled, 0))
  return rounding === 'ceil' && eth.cmp(scaled, String(floor)) > 0 ? floor + 1 : floor
}

/** 5 to `"0.05"`, 1230 to `"12.30"`. */
export function fromSteps(steps: number): Eth {
  const whole = Math.floor(steps / 100)
  return `${String(whole)}.${String(steps % 100).padStart(2, '0')}`
}

/** `null` when the slider has nothing to choose from: no NFTs, or all at one price step. */
export function boundsFromFacets(price: Facets['price']): PriceBounds | null {
  if (!price) return null
  const bounds = { min: toSteps(price.min, 'floor'), max: toSteps(price.max, 'ceil') }
  return bounds.min < bounds.max ? bounds : null
}

export type StepRange = readonly [number, number]

/** The draft range for the URL's prices, clamped to the bounds. */
export function rangeFromSearch(
  bounds: PriceBounds,
  minPrice: Eth | undefined,
  maxPrice: Eth | undefined,
): StepRange {
  const clamp = (steps: number) => Math.min(bounds.max, Math.max(bounds.min, steps))
  return [
    minPrice === undefined ? bounds.min : clamp(toSteps(minPrice, 'floor')),
    maxPrice === undefined ? bounds.max : clamp(toSteps(maxPrice, 'ceil')),
  ]
}

/** The params "Aplicar" writes: an end that sits on its bound is cleared instead of written. */
export function pricesFromRange(
  bounds: PriceBounds,
  [low, high]: StepRange,
): { minPrice: Eth | undefined; maxPrice: Eth | undefined } {
  return {
    minPrice: low <= bounds.min ? undefined : fromSteps(low),
    maxPrice: high >= bounds.max ? undefined : fromSteps(high),
  }
}
