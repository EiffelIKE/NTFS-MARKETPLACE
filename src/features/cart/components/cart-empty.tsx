import { Link } from '@tanstack/react-router'

import { BagIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'

/** "Seu carrinho está vazio" (CART-11): no summary, one way back to the catalog. */
export function CartEmpty() {
  return (
    <section
      aria-labelledby="cart-empty-title"
      className="mx-auto flex max-w-sm flex-col items-center gap-4 py-16 text-center"
    >
      <BagIcon className="size-12 text-secondary" />
      <div className="flex flex-col gap-1">
        <h2 id="cart-empty-title" className="text-title font-bold text-foreground">
          Seu carrinho está vazio
        </h2>
        <p className="text-body text-text-secondary">Adicione NFTs para vê-los aqui.</p>
      </div>
      <Button asChild>
        <Link to="/" hash="mercado">
          Explorar NFTs
        </Link>
      </Button>
    </section>
  )
}
