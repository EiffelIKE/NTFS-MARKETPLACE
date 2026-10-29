import type { NftDetail } from '@/contracts'
import { cn } from '@/lib/utils'

/** "ID do token / Coleção / Atributos" as a description list (DET-06). */
export function MetaList({
  nft,
  className,
}: {
  nft: Pick<NftDetail, 'tokenId' | 'collection' | 'attributes'>
  className?: string
}) {
  const rows: [string, string][] = [
    ['ID do token', nft.tokenId],
    ['Coleção', nft.collection.name],
    ['Atributos', nft.attributes.join(', ')],
  ]
  return (
    <dl className={cn('flex flex-col gap-3 text-body-md text-text-secondary', className)}>
      {rows.map(([label, value]) => (
        <div key={label} className="flex flex-wrap gap-x-2">
          <dt>{label}:</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}
