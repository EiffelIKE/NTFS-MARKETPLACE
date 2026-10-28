import { Link } from '@tanstack/react-router'

import { AlertCircleIcon, DangerTriangleIcon, DeleteIcon } from '@/components/icons'
import { NftImage } from '@/components/nft-image'
import { QuantityStepper } from '@/components/quantity-stepper'
import { Button } from '@/components/ui/button'
import type { CartItem } from '@/contracts'
import { cn } from '@/lib/utils'

import { limitText, lineName, lineNotice, type NoticeAction } from '../model/line-notices'
import { removeButtonId, type CartActions } from '../model/use-cart-actions'

/** The NFT's name, as a link to its page with the line's edition selected. */
export function LineName({ item, className }: { item: CartItem; className?: string }) {
  return (
    <Link
      to="/nfts/$nftId"
      params={{ nftId: item.nftId }}
      search={{ edition: item.editionId }}
      className={cn('text-body-lg font-bold text-foreground hover:text-text-accent', className)}
    >
      {item.name}
    </Link>
  )
}

export function LineImage({ item, className }: { item: CartItem; className?: string }) {
  return (
    <NftImage
      image={item.image}
      slot="thumb"
      // The name next to it already says what it is.
      alt=""
      className={cn('shrink-0 rounded-artwork object-cover', className)}
    />
  )
}

/** The stepper of a line, with the limit text it is held by (CART-07, CART-25). */
export function LineStepper({
  item,
  actions,
  size,
  className,
}: {
  item: CartItem
  actions: CartActions
  size: 'md' | 'sm'
  className?: string
}) {
  const value = actions.quantityOf(item)
  const sellable = item.status !== 'unavailable'
  const atLimit = sellable && value >= item.maxQuantity
  const limitId = `cart-limit-${item.id}`
  const name = lineName(item)
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <QuantityStepper
        size={size}
        value={value}
        min={1}
        max={Math.max(1, item.maxQuantity)}
        onChange={(next) => {
          actions.setQuantity(item, next)
        }}
        label={`Quantidade de ${name}`}
        decreaseLabel={`Diminuir quantidade de ${name}`}
        increaseLabel={`Aumentar quantidade de ${name}`}
        describedBy={atLimit ? limitId : undefined}
        disabled={!sellable}
      />
      {atLimit && (
        <p id={limitId} className="text-caption-sm whitespace-nowrap text-text-secondary">
          {limitText(item)}
        </p>
      )}
    </div>
  )
}

export function RemoveButton({
  item,
  actions,
  className,
}: {
  item: CartItem
  actions: CartActions
  className?: string
}) {
  return (
    <Button
      id={removeButtonId(item.id)}
      type="button"
      variant="ghost"
      size="icon"
      aria-label={`Remover ${lineName(item)}`}
      loading={actions.isBusy(item.id)}
      onClick={() => {
        actions.remove(item)
      }}
      className={cn('text-secondary [&_svg]:size-5', className)}
    >
      <DeleteIcon data-icon="inline-start" />
    </Button>
  )
}

/**
 * The line's notice (CART-20, CART-21): what the server flagged and the one action that resolves
 * it. Plain text in the page; the live change itself is announced once by `useCartLive`.
 */
export function LineNotice({
  item,
  actions,
  className,
}: {
  item: CartItem
  actions: CartActions
  className?: string
}) {
  const notice = lineNotice(item)
  if (!notice) return null
  const name = lineName(item)
  const unavailable = notice.status === 'unavailable'
  const labels: Record<NoticeAction, string> = {
    acknowledge: `Entendi: novo preço de ${name}`,
    adjust: `Ajustar quantidade de ${name}`,
    remove: `Remover item esgotado: ${name}`,
  }
  const run = () => {
    if (notice.action.kind === 'acknowledge') actions.acknowledgePrice(item)
    else if (notice.action.kind === 'adjust') actions.adjustToLimit(item)
    else actions.remove(item)
  }
  return (
    <div
      data-testid="line-notice"
      className={cn(
        'flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-body',
        unavailable ? 'text-error' : 'text-warning',
        className,
      )}
    >
      <p className="flex items-center gap-2">
        {unavailable ? (
          <AlertCircleIcon className="size-4 shrink-0" />
        ) : (
          <DangerTriangleIcon className="size-4 shrink-0" />
        )}
        <span>
          <span className="sr-only">{item.name}: </span>
          {notice.text}
        </span>
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label={labels[notice.action.kind]}
        loading={actions.isBusy(item.id)}
        onClick={run}
        className="h-8 px-3 text-body"
      >
        {notice.action.label}
      </Button>
    </div>
  )
}
