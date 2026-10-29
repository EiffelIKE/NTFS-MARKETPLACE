import { describe, expect, it } from 'vitest'

import { cartLabel } from './cart-label'

describe('cartLabel', () => {
  it('omits the count when empty and pluralizes in pt-BR', () => {
    expect(cartLabel(0)).toBe('Carrinho')
    expect(cartLabel(1)).toBe('Carrinho, 1 item')
    expect(cartLabel(6)).toBe('Carrinho, 6 itens')
  })
})
