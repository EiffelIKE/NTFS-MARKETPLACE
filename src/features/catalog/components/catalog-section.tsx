import { Link } from '@tanstack/react-router'
import * as React from 'react'

import { announce } from '@/components/feedback'
import { AlertCircleIcon } from '@/components/icons'
import { LoadingRegion } from '@/components/loading-region'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { NftSegment } from '@/contracts'
import { cn } from '@/lib/utils'

import { nftCount } from '../model/labels'
import { isDefaultState, isFavoritesOnly, withPage, type CatalogSearch } from '../model/search'
import { useCatalogResults } from '../model/use-catalog-results'
import { useCatalogSearch } from '../model/use-catalog-search'
import { FeaturedBanner } from '../home/featured-banner'
import { CatalogPagination } from './catalog-pagination'
import { EmptyState } from './empty-state'
import { FiltersPanel } from './filters-panel'
import { GridSkeleton, ProductGrid } from './product-grid'
import { ResultsBar } from './results-bar'
import { SegmentTabs } from './segment-tabs'
import { SortSelect } from './sort-select'

/**
 * "Mercado" (`#mercado`): filters, toolbar, results bar, grid, pagination and every data state
 * (spec 05 design §10). The URL is the only state; this component reads it and the query for it.
 */
export function CatalogSection() {
  const { search, change, clear } = useCatalogSearch()
  const results = useCatalogResults(search)
  const { data, shown, isPending, isError, error, isPlaceholderData, isOutdated, refetch } = results

  const favoritesMode = search.favorites !== undefined
  const segment = search.segment ?? 'all'
  const page = search.page ?? 1

  // Moves focus to the heading after a page link was used (CAT-11). Back and forward keep the
  // router's scroll restoration instead, so the flag is armed by the links only.
  const focusAfterPage = React.useRef(false)
  const heading = React.useRef<HTMLHeadingElement>(null)
  React.useEffect(() => {
    if (!focusAfterPage.current) return
    focusAfterPage.current = false
    document.getElementById('mercado')?.scrollIntoView({ block: 'start' })
    heading.current?.focus({ preventScroll: true })
  }, [page])

  // The result count, once per settled state (one live channel per event: the loading region owns
  // "Carregando"/"Atualizando", this owns the outcome). The first load stays silent.
  const settled = data && !isPlaceholderData ? data : undefined
  const announceKey = settled
    ? `${JSON.stringify(settled.applied)}|${String(settled.totalItems)}`
    : null
  const announcedBefore = React.useRef(false)
  React.useEffect(() => {
    if (announceKey === null || !settled) return
    if (announcedBefore.current) {
      announce(
        `${nftCount(settled.totalItems)} ${settled.totalItems === 1 ? 'encontrado' : 'encontrados'}`,
      )
    }
    announcedBefore.current = true
    // `settled` itself changes when a realtime patch lands; only a new state or count is news.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [announceKey])

  const loading = isPending || isPlaceholderData

  return (
    <section
      id="mercado"
      aria-labelledby="mercado-title"
      className="scroll-mt-6 lg:grid lg:grid-cols-[var(--spacing-sidebar)_minmax(0,1fr)] lg:items-start lg:gap-12"
    >
      <aside aria-label="Filtros" className="hidden lg:flex lg:flex-col lg:gap-6">
        {!(isError && !shown) && (
          <FiltersPanel search={search} facets={shown?.facets} onChange={change} />
        )}
        <FeaturedBanner />
      </aside>

      <Tabs
        value={segment}
        onValueChange={(value) => {
          const next = NftSegment.parse(value)
          change({ segment: next === 'all' ? undefined : next })
        }}
        className="min-w-0 gap-4 lg:gap-6"
      >
        <h2
          id="mercado-title"
          ref={heading}
          tabIndex={-1}
          className={favoritesMode ? 'text-heading text-foreground outline-none' : 'sr-only'}
        >
          {favoritesMode ? 'Lista de interesse' : 'Mercado'}
        </h2>

        <div className="flex items-center justify-between gap-6">
          <SegmentTabs active={segment} className="min-w-0 flex-1 lg:flex-none" />
          <SortSelect
            value={search.sort}
            onChange={(sort) => {
              change({ sort })
            }}
            className="hidden shrink-0 lg:flex"
          />
        </div>

        <TabsContent
          value={segment}
          tabIndex={-1}
          className="flex flex-col gap-4 outline-none lg:gap-6"
        >
          {!isDefaultState(search) && (
            <ResultsBar totalItems={shown?.totalItems} q={search.q} onClear={clear} />
          )}

          <LoadingRegion
            loading={loading}
            label={isPending ? 'Carregando catálogo' : 'Atualizando resultados'}
            className="flex flex-col gap-8 lg:gap-12"
          >
            {error && (
              <Alert>
                <AlertCircleIcon />
                <AlertTitle>Não foi possível carregar o catálogo</AlertTitle>
                <AlertDescription>{error.message}</AlertDescription>
                <AlertAction>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      void refetch()
                    }}
                  >
                    Tentar novamente
                  </Button>
                </AlertAction>
              </Alert>
            )}

            {isPending && <GridSkeleton />}

            {shown && (
              <div
                data-testid="catalog-results"
                data-outdated={isOutdated || undefined}
                className={cn(
                  'flex flex-col gap-8 transition-opacity motion-reduce:transition-none lg:gap-12',
                  isOutdated && 'opacity-60',
                )}
              >
                {shown.items.length > 0 ? (
                  <ProductGrid items={shown.items} />
                ) : (
                  <Empty
                    totalItems={shown.totalItems}
                    onClear={clear}
                    search={search}
                    onNavigate={() => {
                      focusAfterPage.current = true
                    }}
                  />
                )}
                <CatalogPagination
                  page={shown.page}
                  totalPages={shown.totalPages}
                  onNavigate={() => {
                    focusAfterPage.current = true
                  }}
                />
              </div>
            )}
          </LoadingRegion>
        </TabsContent>
      </Tabs>
    </section>
  )
}

function Empty({
  totalItems,
  search,
  onClear,
  onNavigate,
}: {
  totalItems: number
  search: CatalogSearch
  onClear: () => void
  onNavigate: () => void
}) {
  if (totalItems > 0) {
    return (
      <EmptyState title="Esta página não existe" hint="Os resultados terminam antes desta página.">
        <Button asChild>
          <Link
            to="/"
            search={(prev) => withPage(prev, 1)}
            resetScroll={false}
            onClick={onNavigate}
          >
            Ir para a primeira página
          </Link>
        </Button>
      </EmptyState>
    )
  }
  if (isDefaultState(search)) {
    return (
      <EmptyState
        title="Nenhum NFT disponível no momento"
        hint="Volte em breve para conferir novos lançamentos."
      />
    )
  }
  if (isFavoritesOnly(search)) {
    return (
      <EmptyState
        title="Você ainda não favoritou nenhum NFT."
        hint="Favorite NFTs para vê-los aqui."
      >
        <Button asChild>
          <Link to="/">Explorar o mercado</Link>
        </Button>
      </EmptyState>
    )
  }
  return (
    <EmptyState title="Nenhum NFT encontrado" hint="Tente ajustar a busca ou os filtros.">
      <Button variant="outline" onClick={onClear}>
        Limpar filtros
      </Button>
    </EmptyState>
  )
}
