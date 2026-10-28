import { getRouteApi } from '@tanstack/react-router'

import { CLEARED, withChange, type CatalogChange, type CatalogSearch } from './search'

const homeRoute = getRouteApi('/')

/**
 * The home route's search params and the only way controls change them (CAT-04, CAT-05): every
 * change goes through `withChange` (the pagination links use `withPage`), so the page always resets with a filter and a
 * param with its default value never reaches the URL. Filters, segment, sort and page push a
 * history entry; typing in the search field replaces the current one.
 */
export function useCatalogSearch() {
  const search: CatalogSearch = homeRoute.useSearch()
  const navigate = homeRoute.useNavigate()

  return {
    search,
    change: (change: CatalogChange, { replace = false }: { replace?: boolean } = {}) => {
      void navigate({
        search: (prev: CatalogSearch) => withChange(prev, change),
        replace,
        resetScroll: false,
      })
    },
    clear: () => {
      void navigate({ search: CLEARED, resetScroll: false })
    },
  }
}
