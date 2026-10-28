import { describe, expect, it } from 'vitest'

import { pageWindow } from './page-window'

describe('pageWindow (CAT-11)', () => {
  it('lists every page when there are few', () => {
    expect(pageWindow(1, 4)).toEqual([1, 2, 3, 4])
    expect(pageWindow(2, 3)).toEqual([1, 2, 3])
  })

  it('collapses a long range around the current page', () => {
    expect(pageWindow(1, 10)).toEqual([1, 2, null, 10])
    expect(pageWindow(5, 10)).toEqual([1, null, 4, 5, 6, null, 10])
    expect(pageWindow(10, 10)).toEqual([1, null, 9, 10])
  })

  it('fills a gap of one page instead of showing an ellipsis for it', () => {
    expect(pageWindow(4, 8)).toEqual([1, 2, 3, 4, 5, null, 8])
  })
})
