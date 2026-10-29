import { describe, expect, it } from 'vitest'

import { slideAt, slideLabel, stepSlide } from './slides'

describe('slideAt', () => {
  it('rounds to the nearest slide, so the dot flips at the halfway point', () => {
    expect(slideAt(0, 300, 4)).toBe(0)
    expect(slideAt(149, 300, 4)).toBe(0)
    expect(slideAt(150, 300, 4)).toBe(1)
    expect(slideAt(900, 300, 4)).toBe(3)
  })

  it('stays inside the track on overscroll and before layout', () => {
    expect(slideAt(-40, 300, 4)).toBe(0)
    expect(slideAt(1200, 300, 4)).toBe(3)
    expect(slideAt(300, 0, 4)).toBe(0)
    expect(slideAt(300, 300, 0)).toBe(0)
  })
})

describe('stepSlide', () => {
  it('moves by one and stops at both ends', () => {
    expect(stepSlide(1, 1, 4)).toBe(2)
    expect(stepSlide(1, -1, 4)).toBe(0)
    expect(stepSlide(0, -1, 4)).toBeNull()
    expect(stepSlide(3, 1, 4)).toBeNull()
    expect(stepSlide(0, 1, 1)).toBeNull()
  })
})

describe('slideLabel', () => {
  it('is one-based', () => {
    expect(slideLabel(0, 4)).toBe('Imagem 1 de 4')
    expect(slideLabel(3, 4)).toBe('Imagem 4 de 4')
  })
})
