import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { NftSort } from '@/contracts'
import { cn } from '@/lib/utils'

import { SORT_LABELS } from '../model/labels'
import type { CatalogSearch } from '../model/search'

/** "Ordenar por:" plus the current order, as the Figma sort control (CAT-10). */
export function SortSelect({
  value,
  onChange,
  className,
}: {
  value: CatalogSearch['sort']
  onChange: (sort: CatalogSearch['sort']) => void
  className?: string
}) {
  const current = value ?? 'recent'
  return (
    <div className={cn('flex items-center gap-2 text-body text-foreground', className)}>
      <span aria-hidden="true">Ordenar por:</span>
      <Select
        value={current}
        onValueChange={(next) => {
          const sort = NftSort.parse(next)
          onChange(sort === 'recent' ? undefined : sort)
        }}
      >
        <SelectTrigger aria-label={`Ordenar por: ${SORT_LABELS[current]}`} className="px-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          {NftSort.options.map((sort) => (
            <SelectItem key={sort} value={sort}>
              {SORT_LABELS[sort]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
