/** mulberry32: a tiny seeded generator, so fixtures and "variable" latency are reproducible. */
export interface Prng {
  /** Float in [0, 1). */
  next(): number
  /** Integer in [min, max], both inclusive. */
  int(min: number, max: number): number
  pick<T>(items: readonly T[]): T
  chance(probability: number): boolean
  /** Returns a shuffled copy (Fisher-Yates). */
  shuffle<T>(items: readonly T[]): T[]
}

export function createPrng(seed: number): Prng {
  let state = seed >>> 0
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1))
  return {
    next,
    int,
    pick: (items) => {
      const item = items[int(0, items.length - 1)]
      if (item === undefined) throw new RangeError('pick() from an empty list')
      return item
    },
    chance: (probability) => next() < probability,
    shuffle: (items) => {
      const copy = [...items]
      for (let i = copy.length - 1; i > 0; i--) {
        const j = int(0, i)
        const a = copy[i]
        const b = copy[j]
        if (a !== undefined && b !== undefined) {
          copy[i] = b
          copy[j] = a
        }
      }
      return copy
    },
  }
}
