/** Accessible cart name with the count (DS-28): "Carrinho", "Carrinho, 1 item", "Carrinho, 3 itens". */
export function cartLabel(count: number) {
  if (count <= 0) return 'Carrinho'
  return `Carrinho, ${String(count)} ${count === 1 ? 'item' : 'itens'}`
}
