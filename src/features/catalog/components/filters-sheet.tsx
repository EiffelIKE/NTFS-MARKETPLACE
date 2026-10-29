import { FilterIcon } from '@/components/icons'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

import { nftCount } from '../model/labels'
import { activeFilterCount } from '../model/search'
import { useCatalogResults } from '../model/use-catalog-results'
import { useCatalogSearch } from '../model/use-catalog-search'
import { FiltersPanel } from './filters-panel'
import { SortSelect } from './sort-select'

/**
 * The mobile filter button and its bottom sheet (CAT-26): the desktop filters plus the sort order.
 * Changes apply to the URL at once, as on desktop, so results update behind the sheet.
 */
export function FiltersSheet() {
  const { search, change, clear } = useCatalogSearch()
  const { shown } = useCatalogResults(search)
  const active = activeFilterCount(search)

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          size="icon-lg"
          aria-label={active > 0 ? `Filtros, ${String(active)} ativos` : 'Filtros'}
          className="relative shrink-0"
        >
          <FilterIcon className="size-5.5" />
          {active > 0 && (
            <Badge variant="count" className="absolute -top-1 -right-1" aria-hidden="true">
              {active}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>Filtros</SheetTitle>
          <SheetDescription className="sr-only">
            Combine coleções, faixa de preço, rede e ordem. Os resultados mudam ao escolher.
          </SheetDescription>
        </SheetHeader>
        <SortSelect
          value={search.sort}
          onChange={(sort) => {
            change({ sort })
          }}
        />
        <FiltersPanel bare search={search} facets={shown?.facets} onChange={change} />
        <SheetFooter className="sticky -bottom-6 z-10 -mb-[calc(24px+env(safe-area-inset-bottom))] bg-surface-card pt-3 pb-[calc(24px+env(safe-area-inset-bottom))]">
          <SheetClose asChild>
            <Button>{shown ? `Ver ${nftCount(shown.totalItems)}` : 'Ver resultados'}</Button>
          </SheetClose>
          <Button variant="outline" onClick={clear}>
            Limpar filtros
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
