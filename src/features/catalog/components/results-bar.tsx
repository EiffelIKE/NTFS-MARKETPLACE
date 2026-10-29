import { Button } from '@/components/ui/button'

import { nftCount } from '../model/labels'

/** The count, the search term and "Limpar filtros", while the catalog is narrowed (CAT-13). */
export function ResultsBar({
  totalItems,
  q,
  onClear,
}: {
  /** Unknown while the catalog failed to load and nothing was shown before. */
  totalItems: number | undefined
  q: string | undefined
  onClear: () => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
      <p data-testid="results-count" className="text-body text-text-secondary">
        {totalItems !== undefined && nftCount(totalItems)}
        {q !== undefined && ` para “${q}”`}
      </p>
      <Button variant="link" className="text-body" onClick={onClear}>
        Limpar filtros
      </Button>
    </div>
  )
}
