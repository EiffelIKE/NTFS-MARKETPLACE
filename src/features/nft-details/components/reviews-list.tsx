import type { NftDetail } from '@/contracts'

import { formatReviewDate } from '../model/format'
import { Stars } from './price-rating'

/** The reviews the API returned (at most three) and how many exist (DET-07). */
export function ReviewsList({ nft }: { nft: Pick<NftDetail, 'reviews' | 'reviewCount'> }) {
  if (nft.reviews.length === 0) {
    return <p className="text-body text-text-secondary">Este NFT ainda não tem avaliações.</p>
  }
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-4">
        {nft.reviews.map((review) => (
          <li key={review.id}>
            <article className="flex flex-col gap-2 rounded-md bg-surface-card p-4">
              <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h3 className="text-body-lg font-bold text-foreground">{review.author}</h3>
                <Stars rating={review.rating} label={`${String(review.rating)} de 5 estrelas`} />
                <time dateTime={review.createdAt} className="text-caption text-text-secondary">
                  {formatReviewDate(review.createdAt)}
                </time>
              </header>
              <p className="text-body text-text-secondary">{review.comment}</p>
            </article>
          </li>
        ))}
      </ul>
      <p className="text-caption text-text-secondary">
        Mostrando {nft.reviews.length} de {nft.reviewCount} avaliações
      </p>
    </div>
  )
}
