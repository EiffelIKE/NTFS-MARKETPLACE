import { QuantityStepper } from '@/components/quantity-stepper'
import { Button } from '@/components/ui/button'
import type { NftDetail } from '@/contracts'
import { FavoriteButton } from '@/features/favorites/components/favorite-button'
import { cn } from '@/lib/utils'

import type { PurchaseSelection } from '../hooks/use-purchase-selection'

/** Desktop actions row (Figma): stepper on the left, "COMPRAR" and "Favoritar" on the right. */
export function PurchaseActions({
  nft,
  selection,
  canBuy,
  pending,
  onBuy,
  className,
}: {
  nft: Pick<NftDetail, 'id' | 'name'>
  selection: PurchaseSelection
  canBuy: boolean
  pending: boolean
  onBuy: () => void
  className?: string
}) {
  return (
    <div className={cn('flex items-center justify-between gap-4', className)}>
      <QuantityStepper
        value={selection.quantity}
        min={1}
        max={Math.max(1, selection.max)}
        onChange={selection.changeQuantity}
        label={`Quantidade de ${nft.name}`}
        disabled={!canBuy || pending}
      />
      <div className="flex gap-2">
        <Button
          type="button"
          disabled={!canBuy}
          loading={pending}
          onClick={onBuy}
          className="w-32.5 px-0 text-body"
        >
          COMPRAR
        </Button>
        <FavoriteButton nft={nft} variant="button" className="text-body" />
      </div>
    </div>
  )
}
