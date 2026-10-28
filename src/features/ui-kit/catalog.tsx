import type { NftSummary } from '@/contracts'

import { CardSkeleton } from '@/features/catalog/components/card-skeleton'
import { DetailsAction, ProductCard } from '@/features/catalog/components/product-card'
import { staticImage } from '@/features/catalog/content/static-images'

import { Section } from './section'

const sample = (overrides: Partial<NftSummary>): NftSummary => ({
  id: 'emerald-ape-042',
  name: 'Emerald Ape #042',
  collection: { id: 'kurio-apes', name: 'Kurio Apes' },
  category: 'arte-digital',
  network: 'ethereum',
  image: staticImage('ape-varsity', 'Macaco de óculos redondos e jaqueta universitária verde'),
  price: '1.19',
  rarity: 'common',
  available: true,
  listedAt: '2026-09-30T23:00:00.000Z',
  version: 1,
  ...overrides,
})

/** Catalog cards in every variant and state (spec 05 T04). */
export function CatalogCardsSection() {
  return (
    <Section id="cartoes" title="Cartões do catálogo" className="items-start">
      <div data-testid="gallery-cards" className="grid w-full grid-cols-2 gap-4 lg:grid-cols-4">
        <ProductCard nft={sample({})} actions={<DetailsAction nft={sample({})} />} />
        <ProductCard
          nft={sample({
            id: 'neon-vessel-552',
            name: 'Neon Vessel #552',
            price: '1.99',
            previousPrice: '2.29',
            rarity: 'epic',
          })}
        />
        <ProductCard
          nft={sample({ id: 'crown-relic-999', name: 'Crown Relic #999', available: false })}
        />
        <ProductCard nft={sample({ rarity: 'legendary' })} variant="compact" />
        <CardSkeleton />
        <CardSkeleton variant="compact" />
      </div>
    </Section>
  )
}
