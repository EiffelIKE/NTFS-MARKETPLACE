import type { Cart } from '@/contracts'
import { formatEth } from '@/lib/money'
import { cn } from '@/lib/utils'

import type { CartActions } from '../model/use-cart-actions'
import { LineImage, LineName, LineNotice, LineStepper, RemoveButton } from './line-parts'

/**
 * Mobile lines (Figma): cards on `surface-card` with the image flush left, the name, the edition,
 * the line total and the stepper. Figma overlaps the trash button with the plus button on one card;
 * here it sits at the card's top right (recorded deviation).
 */
export function CartLineCards({ cart, actions }: { cart: Cart; actions: CartActions }) {
  return (
    <ul aria-label="Itens do carrinho" className="flex flex-col gap-5">
      {cart.items.map((item) => {
        const unavailable = item.status === 'unavailable'
        return (
          <li
            key={item.id}
            data-testid="cart-line"
            data-item-id={item.id}
            className="overflow-hidden rounded-card-mobile bg-surface-card"
          >
            <div className="flex min-h-25">
              <LineImage
                item={item}
                className={cn('size-25 self-stretch rounded-none', unavailable && 'opacity-60')}
              />
              <div className="relative flex min-w-0 flex-1 flex-col justify-between gap-2 py-3 pr-3 pl-4">
                <div className="pr-10">
                  <LineName item={item} className="line-clamp-2" />
                  <p className="text-body font-normal text-text-secondary">
                    Edição: {item.editionLabel}
                  </p>
                </div>
                <RemoveButton item={item} actions={actions} className="absolute top-1 right-1" />
                <div className="flex items-end justify-between gap-2">
                  <p
                    className={cn(
                      'text-title font-bold text-text-accent tabular-nums',
                      unavailable && 'line-through opacity-60',
                    )}
                  >
                    {formatEth(item.lineTotal)}
                    {unavailable && <span className="sr-only"> (não incluído no total)</span>}
                  </p>
                  <LineStepper item={item} actions={actions} size="sm" className="items-end" />
                </div>
              </div>
            </div>
            {item.status !== 'ok' && (
              <div className="border-t border-border px-4 py-3">
                <LineNotice item={item} actions={actions} />
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
