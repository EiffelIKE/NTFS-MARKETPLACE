import type { Cart } from '@/contracts'
import { formatEth } from '@/lib/money'
import { cn } from '@/lib/utils'

import type { CartActions } from '../model/use-cart-actions'
import { LineImage, LineName, LineNotice, LineStepper, RemoveButton } from './line-parts'

const headClass = 'border-b border-border pb-3 text-left text-body-lg font-bold text-foreground'
const cell = 'bg-surface-card py-0'

/**
 * Desktop lines (Figma "Carrinho de NFTs", CART-06): a real table, rows 70 tall on `surface-card`
 * with 12 between them. A line's notice is a full-width row of its own right under the line, and
 * the lines keep the order the API returned.
 */
export function CartTable({ cart, actions }: { cart: Cart; actions: CartActions }) {
  return (
    <table className="-mt-3 w-full border-separate border-spacing-y-3">
      <caption className="sr-only">Itens do carrinho</caption>
      <thead>
        <tr>
          <th scope="col" className={headClass}>
            NFTs
          </th>
          <th scope="col" className={cn(headClass, 'w-24 xl:w-34.5')}>
            Preço
          </th>
          <th scope="col" className={cn(headClass, 'w-28 xl:w-34')}>
            Edições
          </th>
          <th scope="col" className={cn(headClass, 'w-24 xl:w-34.5')}>
            Total
          </th>
          <th scope="col" className="w-14 border-b border-border pb-3 xl:w-16">
            <span className="sr-only">Remover</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {cart.items.flatMap((item) => {
          const unavailable = item.status === 'unavailable'
          const dim = unavailable ? 'opacity-60' : undefined
          return [
            <tr key={item.id} data-testid="cart-line" data-item-id={item.id} className="h-17.5">
              <td className={cn(cell, 'rounded-l-md pl-0')}>
                <div className="flex items-center gap-4">
                  <LineImage
                    item={item}
                    className={cn('size-17.5 rounded-none rounded-l-md', dim)}
                  />
                  <div className="flex min-w-0 flex-col py-1">
                    <LineName item={item} className="line-clamp-2" />
                    <p className="text-caption-sm text-text-secondary">
                      ID do token: {item.tokenId}
                    </p>
                    <p className="text-caption-sm text-text-secondary">
                      Edição: {item.editionLabel}
                    </p>
                  </div>
                </div>
              </td>
              <td className={cn(cell, 'text-body-lg text-text-accent tabular-nums', dim)}>
                {formatEth(item.unitPrice)}
              </td>
              <td className={cell}>
                <LineStepper item={item} actions={actions} size="sm" />
              </td>
              <td className={cn(cell, 'text-body-lg font-bold text-text-accent tabular-nums', dim)}>
                <span className={cn(unavailable && 'line-through')}>
                  {formatEth(item.lineTotal)}
                </span>
                {unavailable && <span className="sr-only"> (não incluído no total)</span>}
              </td>
              <td className={cn(cell, 'rounded-r-md text-center')}>
                <RemoveButton item={item} actions={actions} />
              </td>
            </tr>,
            item.status !== 'ok' && (
              <tr key={`${item.id}-notice`}>
                <td
                  colSpan={5}
                  className="rounded-md border border-border-soft bg-surface-card px-4 py-2"
                >
                  <LineNotice item={item} actions={actions} />
                </td>
              </tr>
            ),
          ]
        })}
      </tbody>
    </table>
  )
}
