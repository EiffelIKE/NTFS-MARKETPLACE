import { Link } from '@tanstack/react-router'
import type * as React from 'react'

import { SearchIcon } from '@/components/icons'
import { NftImage } from '@/components/nft-image'
import { Badge } from '@/components/ui/badge'
import type { NftSummary } from '@/contracts'
import { formatEth } from '@/lib/money'
import { cn } from '@/lib/utils'

import { RARITY_LABELS } from '../model/labels'

/**
 * Media box, shared with the skeleton so both reserve the same space. Figma draws the mobile box at
 * 175 × 200 (rounded, gradient) and the desktop one at 258 × 300 (square corners); the artwork is
 * normalized to the center because Figma places it inconsistently.
 */
export const cardMediaShape =
  'aspect-[175/200] rounded-card-mobile lg:aspect-[258/300] lg:rounded-none'
const cardMediaClass = `relative flex items-center justify-center overflow-hidden bg-card-gradient lg:bg-surface-card lg:bg-none ${cardMediaShape}`
// Desktop (Figma 219 × 255): a boxed card like the grid's, artwork inset 4 px.
export const compactMediaShape = 'aspect-square rounded-artwork lg:aspect-[219/255] lg:rounded-none'
const compactMediaClass = `relative overflow-hidden bg-surface-card lg:flex lg:items-center lg:justify-center ${compactMediaShape}`
export const cardArtworkClass =
  'aspect-square w-[calc(100%-8px)] rounded-artwork-mobile object-cover lg:rounded-artwork'

/** The 34 px square buttons of the desktop hover row (Figma); spec 06's heart and cart reuse it. */
export const actionClass =
  'flex size-8.5 cursor-pointer items-center justify-center rounded-sm border border-border-soft bg-ink text-foreground hover:bg-surface-dark [&_svg]:size-4'

/** The "Ver detalhes" action of the desktop hover row; spec 06 adds the heart and the cart. */
export function DetailsAction({ nft }: { nft: Pick<NftSummary, 'id' | 'name'> }) {
  return (
    <Link
      to="/nfts/$nftId"
      params={{ nftId: nft.id }}
      aria-label={`Ver detalhes de ${nft.name}`}
      className={actionClass}
    >
      <SearchIcon />
    </Link>
  )
}

export interface ProductCardProps {
  nft: NftSummary
  /**
   * `grid`: the catalog card, which switches between the mobile and desktop look at `lg`.
   * `compact`: the related-items rows (specs 06 and 07), square media and no actions.
   */
  variant?: 'grid' | 'compact'
  /** The desktop hover row: shown on hover and on keyboard focus, always in the DOM (CAT-21). */
  actions?: React.ReactNode
  /** The mobile top-right corner (spec 06 puts the favorite heart there). */
  cornerAction?: React.ReactNode
  priority?: boolean
  className?: string
}

/**
 * A catalog card: the whole card is one link to the details (the name's link is stretched over it),
 * and the action buttons sit above it. The artwork has an empty `alt` because the name already
 * describes it.
 */
export function ProductCard({
  nft,
  variant = 'grid',
  actions,
  cornerAction,
  priority = false,
  className,
}: ProductCardProps) {
  const compact = variant === 'compact'
  const rarity = nft.rarity === 'common' ? null : RARITY_LABELS[nft.rarity]

  return (
    <article
      data-testid="product-card"
      data-nft-id={nft.id}
      className={cn('group relative flex flex-col gap-2 lg:gap-3', className)}
    >
      <div className={compact ? compactMediaClass : cardMediaClass}>
        <NftImage
          image={nft.image}
          slot={compact ? 'compact' : 'grid'}
          priority={priority}
          alt=""
          className={
            compact
              ? 'size-full rounded-artwork object-cover lg:aspect-square lg:size-auto lg:w-[calc(100%-8px)]'
              : cardArtworkClass
          }
        />
        {rarity && !compact && (
          <Badge
            variant="rarity"
            className="absolute top-4 left-0 h-8 rounded-none pr-3 pl-2 lg:hidden"
          >
            {rarity}
          </Badge>
        )}
        {cornerAction && (
          <div className="absolute top-4 right-3 z-10 lg:hidden">{cornerAction}</div>
        )}
        {actions && (
          <div className="absolute inset-x-0 bottom-3 z-10 hidden justify-center gap-2 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 motion-reduce:transition-none lg:flex">
            {actions}
          </div>
        )}
      </div>

      <div className={cn('flex flex-col px-2 lg:gap-1.5 lg:px-0', compact && 'lg:gap-0')}>
        <h3 className="text-body-md leading-4.5 text-foreground lg:text-body-lg lg:leading-4.5">
          <Link
            to="/nfts/$nftId"
            params={{ nftId: nft.id }}
            preload="intent"
            className="after:absolute after:inset-0"
          >
            {nft.name}
          </Link>
        </h3>
        <p
          className={cn(
            'flex flex-wrap items-baseline gap-x-3 text-body-lg leading-4.5 font-bold text-text-accent',
            !compact && 'lg:text-title',
            'lg:leading-5',
          )}
        >
          <span>
            <span className="sr-only">Preço atual: </span>
            {formatEth(nft.price)}
          </span>
          {nft.previousPrice !== undefined && (
            <s
              className={cn(
                'text-body-lg leading-4.5 font-normal text-secondary',
                !compact && 'lg:text-title',
                'lg:leading-5',
              )}
            >
              <span className="sr-only">Preço anterior: </span>
              {formatEth(nft.previousPrice)}
            </s>
          )}
        </p>
        {!nft.available && <p className="text-caption-sm text-text-secondary">Esgotado</p>}
      </div>
    </article>
  )
}
