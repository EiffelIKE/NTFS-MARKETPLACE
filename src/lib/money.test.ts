import Big from 'big.js'
import { describe, expect, it } from 'vitest'

import { eth, formatEth, formatEthAmount } from './money'

describe('strict arithmetic', () => {
  it('rejects a JavaScript number anywhere', () => {
    expect(() => eth.add('1', 1.5 as never)).toThrow()
    const D = Big()
    D.strict = true
    expect(() => new D(1.5)).toThrow()
  })

  it('rejects an invalid string', () => {
    expect(() => eth.parse('abc')).toThrow()
  })

  it('adds without float drift', () => {
    expect(eth.add('0.1', '0.2')).toBe('0.3')
    expect(eth.add('1.79', '1.79', '0.016')).toBe('3.596')
    expect(eth.add()).toBe('0')
  })

  it('subtracts and compares exactly', () => {
    expect(eth.sub('0.3', '0.1')).toBe('0.2')
    expect(eth.cmp('0.1', '0.10')).toBe(0)
    expect(eth.cmp('0.1', '0.2')).toBe(-1)
    expect(eth.cmp('12.30', '2.9')).toBe(1)
    expect(eth.min('0.05', '0.5')).toBe('0.05')
    expect(eth.min('3', '2.5')).toBe('2.5')
    expect(eth.isZero('0.000')).toBe(true)
    expect(eth.isZero('0.001')).toBe(false)
  })

  it('multiplies by an integer quantity', () => {
    expect(eth.times('1.79', 2)).toBe('3.58')
    expect(eth.times('0.99', 0)).toBe('0')
    expect(() => eth.times('1', 1.5)).toThrow(RangeError)
    expect(() => eth.times('1', -1)).toThrow(RangeError)
  })

  it('rounds percentages toward zero at 18 decimals', () => {
    expect(eth.percent('3.17', 1000)).toBe('0.317')
    expect(eth.percent('0.000000000000000001', 5000)).toBe('0')
    expect(eth.percent('0.000000000000000003', 5000)).toBe('0.000000000000000001')
  })

  it('keeps 18 decimals without an exponent', () => {
    expect(eth.add('0.000000000000000001', '0')).toBe('0.000000000000000001')
    expect(eth.normalize('5.000')).toBe('5')
  })
})

describe('formatEth', () => {
  it.each([
    ['1.19', '1.19\u00A0ETH'],
    ['12.3', '12.30\u00A0ETH'],
    ['0.00042', '0.00042\u00A0ETH'],
    ['5', '5.00\u00A0ETH'],
    ['0', '0.00\u00A0ETH'],
    ['1000.5', '1000.50\u00A0ETH'],
    ['0.000000000000000001', '0.000000000000000001\u00A0ETH'],
    ['3.186', '3.186\u00A0ETH'],
  ])('formats %s', (value, expected) => {
    expect(formatEth(value)).toBe(expected)
  })

  it('formats a bare amount for ranges', () => {
    expect(`${formatEthAmount('0.02')} - ${formatEthAmount('12.3')} ETH`).toBe('0.02 - 12.30 ETH')
  })
})
