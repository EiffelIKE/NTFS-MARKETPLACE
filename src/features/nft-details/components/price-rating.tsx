import { StarIcon } from '@/components/icons'
import { cn } from '@/lib/utils'
import type { NftDetail } from '@/contracts'
import { formatEth } from '@/lib/money'

import { ratingValue, reviewCountLabel } from '../model/format'

/** Five stars, filled up to the rounded rating; the group carries the text alternative (DET-06). */
export function Stars({
  rating,
  label = `Avaliação ${ratingValue(rating)} de 5`,
  className,
}: {
  rating: number
  label?: string
  className?: string
}) {
  const filled = Math.round(rating)
  return (
    <span role="img" aria-label={label} className={cn('flex items-center gap-1', className)}>
      {Array.from({ length: 5 }, (_, index) => (
        <StarIcon
          key={index}
          className={cn('size-3.75', index < filled ? 'text-primary' : 'text-border-soft')}
        />
      ))}
    </span>
  )
}

/** Desktop price row: price (and the previous one, struck through) and the rating with its link. */
export function PriceRating({
  nft,
  onShowReviews,
  className,
}: {
  nft: Pick<NftDetail, 'price' | 'previousPrice' | 'rating' | 'reviewCount'>
  onShowReviews: () => void
  className?: string
}) {
  return (
    <div className={cn('flex items-center justify-between gap-4', className)}>
      <p className="flex items-baseline gap-3 text-title leading-6 font-bold text-text-accent lg:text-[1.375rem]">
        <span>
          <span className="sr-only">Preço atual: </span>
          {formatEth(nft.price)}
        </span>
        {nft.previousPrice !== undefined && (
          <s className="font-normal text-secondary">
            <span className="sr-only">Preço anterior: </span>
            {formatEth(nft.previousPrice)}
          </s>
        )}
      </p>
      <div className="flex items-center gap-1 text-body">
        <Stars rating={nft.rating} />
        <button
          type="button"
          onClick={onShowReviews}
          className="cursor-pointer text-foreground underline-offset-4 hover:text-text-accent hover:underline"
        >
          {reviewCountLabel(nft.reviewCount)}
        </button>
      </div>
    </div>
  )
}

/** Mobile rating chip next to the name: star, "4.8" and the count (Figma). */
export function RatingChip({
  rating,
  reviewCount,
  onShowReviews,
  className,
}: {
  rating: number
  reviewCount: number
  onShowReviews: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onShowReviews}
      aria-label={`Avaliação ${ratingValue(rating)} de 5, ${reviewCountLabel(reviewCount)}. Ver avaliações`}
      className={cn(
        'flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-full border border-primary px-2.5 text-caption text-foreground',
        className,
      )}
    >
      <StarIcon aria-hidden="true" className="size-3.5 text-primary" />
      <span aria-hidden="true">
        <b>{ratingValue(rating)}</b>({reviewCount})
      </span>
    </button>
  )
}
