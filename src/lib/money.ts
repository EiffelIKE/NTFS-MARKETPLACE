import Big from 'big.js'

import type { Eth } from '@/contracts/common'

// Single money module shared by the client and the mocks (spec 02 §5). ETH amounts are decimal
// strings end to end: no value ever becomes a JavaScript `number`.

/** Private constructor, so the global `Big` configuration stays untouched. */
const D = Big()
// Strict mode makes `new D(1.5)` throw: a number can never enter the arithmetic.
D.strict = true
D.DP = 18
D.RM = Big.roundDown

export const ETH_DECIMALS = 18

function toEth(value: Big): Eth {
  // `toFixed()` never uses an exponent; `big.js` already strips trailing zeros from its digits.
  return value.toFixed()
}

function assertQuantity(quantity: number): void {
  if (!Number.isSafeInteger(quantity) || quantity < 0) {
    throw new RangeError(`Quantity must be a non-negative integer, got ${String(quantity)}`)
  }
}

export const eth = {
  /** Throws on an invalid string; contracts validate wire values before they get here. */
  parse(value: Eth): Big {
    return new D(value)
  },
  add(...values: Eth[]): Eth {
    return toEth(values.reduce((sum, value) => sum.plus(new D(value)), new D('0')))
  },
  sub(a: Eth, b: Eth): Eth {
    return toEth(new D(a).minus(new D(b)))
  },
  /** `a × quantity`, for an integer quantity. */
  times(a: Eth, quantity: number): Eth {
    assertQuantity(quantity)
    return toEth(new D(a).times(new D(String(quantity))))
  },
  /** `a × bps / 10000`, rounded toward zero at 18 decimals (the one documented rounding rule). */
  percent(a: Eth, bps: number): Eth {
    assertQuantity(bps)
    return toEth(new D(a).times(new D(String(bps))).div(new D('10000')))
  },
  min(a: Eth, b: Eth): Eth {
    return eth.cmp(a, b) <= 0 ? toEth(new D(a)) : toEth(new D(b))
  },
  cmp(a: Eth, b: Eth): -1 | 0 | 1 {
    return new D(a).cmp(new D(b))
  },
  isZero(a: Eth): boolean {
    return new D(a).eq(new D('0'))
  },
  /** Rounds toward zero to `dp` decimals. */
  round(a: Eth, dp: number): Eth {
    return toEth(new D(a).round(dp, Big.roundDown))
  },
  /** Normalized string (no exponent, no trailing zeros). */
  normalize(a: Eth): Eth {
    return toEth(new D(a))
  },
} as const

/**
 * `"1.19"`: integer part as is (no grouping), fractional part padded to two digits and never cut,
 * so `0.00042` stays `0.00042`. Formatting never rounds (API-08).
 */
export function formatEthAmount(value: Eth): string {
  const [integer = '0', fraction = ''] = toEth(new D(value)).split('.')
  return `${integer}.${fraction.padEnd(2, '0')}`
}

/** `"1.19 ETH"`, joined with a non-breaking space so the unit never wraps away. */
export function formatEth(value: Eth): string {
  return `${formatEthAmount(value)}\u00A0ETH`
}
