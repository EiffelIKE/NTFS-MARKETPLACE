import * as React from 'react'

import { CartIcon } from '@/components/icons'
import { QuantityStepper } from '@/components/quantity-stepper'
import { Button } from '@/components/ui/button'
import type { NftDetail } from '@/contracts'
import { useBottomBarInset } from '@/hooks/use-bottom-bar-inset'
import { formatEth } from '@/lib/money'

import type { PurchaseSelection } from '../hooks/use-purchase-selection'

/**
 * The fixed bottom bar of the mobile screen (Figma): quantity, price, "Comprar NFT" (adds and goes
 * to the cart) and the cart button (adds and stays). It follows the content in the DOM, so the tab
 * order matches what is on screen, and its controls are at least 44 px tall.
 */
export function MobileBuyBar({
  nft,
  selection,
  canBuy,
  pending,
  onBuy,
  onAddToCart,
}: {
  nft: Pick<NftDetail, 'name' | 'price'>
  selection: PurchaseSelection
  canBuy: boolean
  pending: boolean
  onBuy: () => void
  onAddToCart: () => void
}) {
  const bar = React.useRef<HTMLElement>(null)
  useBottomBarInset(bar)

  return (
    <section
      ref={bar}
      aria-label="Compra"
      className="fixed inset-x-0 bottom-0 z-30 rounded-t-[30px] bg-surface-card pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_var(--color-ink)]"
    >
      <div className="mx-auto flex max-w-150 flex-col gap-4 px-6 pt-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-body font-medium text-text-secondary">Qtd.</span>
            <QuantityStepper
              size="sm"
              value={selection.quantity}
              min={1}
              max={Math.max(1, selection.max)}
              onChange={selection.changeQuantity}
              label={`Quantidade de ${nft.name}`}
              disabled={!canBuy || pending}
            />
          </div>
          <p className="text-title font-bold text-text-accent">
            <span className="sr-only">Preço: </span>
            {formatEth(nft.price)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            disabled={!canBuy}
            loading={pending}
            onClick={onBuy}
            className="h-15 flex-1 rounded-full bg-primary-soft text-body-lg disabled:bg-none"
          >
            Comprar NFT
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            aria-label="Adicionar ao carrinho"
            disabled={!canBuy}
            loading={pending}
            onClick={onAddToCart}
            className="size-15 rounded-full [&_svg]:size-6"
          >
            <CartIcon data-icon="inline-start" />
          </Button>
        </div>
      </div>
    </section>
  )
}
