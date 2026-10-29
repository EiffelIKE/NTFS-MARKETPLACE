import type * as React from 'react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { NftDetail } from '@/contracts'
import { cn } from '@/lib/utils'

import { shortAddress } from '../model/format'
import { ReviewsList } from './reviews-list'

export type DetailsTab = 'details' | 'reviews'

/**
 * "Detalhes do NFT" and "Avaliações de colecionadores (n)" (DET-07), a controlled tablist so the
 * rating link can open the reviews. Figma swaps the "Contrato" and "Direitos autorais" values;
 * each value sits under its own label here.
 */
export function DetailsTabs({
  nft,
  tab,
  onTabChange,
  ref,
  className,
}: {
  nft: NftDetail
  tab: DetailsTab
  onTabChange: (tab: DetailsTab) => void
  ref?: React.Ref<HTMLDivElement>
  className?: string
}) {
  const { specs } = nft
  const rows: [string, string][] = [
    ['Rede', specs.network],
    [
      'Contrato',
      `${shortAddress(specs.contract.address)} • Contrato inteligente ${specs.contract.standard} verificado.`,
    ],
    ['Direitos autorais', specs.royalty],
  ]
  return (
    <div ref={ref} className={cn('scroll-mt-6', className)}>
      <Tabs
        value={tab}
        onValueChange={(value) => {
          onTabChange(value === 'reviews' ? 'reviews' : 'details')
        }}
        className="gap-3"
      >
        <TabsList aria-label="Informações do NFT" className="gap-8">
          <TabsTrigger value="details">Detalhes do NFT</TabsTrigger>
          <TabsTrigger value="reviews">
            Avaliações de colecionadores ({nft.reviewCount})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="details" className="flex flex-col gap-4 text-body text-text-secondary">
          <h2 className="sr-only">Detalhes</h2>
          {nft.longDescription.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          <dl className="flex flex-col gap-3">
            {rows.map(([label, value]) => (
              <div key={label}>
                <dt className="font-bold text-foreground">{label}:</dt>
                <dd className="break-words">{value}</dd>
              </div>
            ))}
          </dl>
        </TabsContent>
        <TabsContent value="reviews">
          <h2 className="sr-only">Avaliações</h2>
          <ReviewsList nft={nft} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
