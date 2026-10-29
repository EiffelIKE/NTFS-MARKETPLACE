import * as React from 'react'

import { CheckIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import type { Facets } from '@/contracts'
import { formatEth, formatEthAmount } from '@/lib/money'
import { cn } from '@/lib/utils'

import {
  boundsFromFacets,
  fromSteps,
  pricesFromRange,
  rangeFromSearch,
  type StepRange,
} from '../model/price-range'
import { splitList, toggleInList, type CatalogChange, type CatalogSearch } from '../model/search'

export interface FiltersPanelProps {
  search: CatalogSearch
  /** `undefined` before the first response: the rows render as skeletons (CAT-14). */
  facets: Facets | undefined
  onChange: (change: CatalogChange) => void
  /** Inside the mobile sheet, which already is a card. */
  bare?: boolean
  className?: string
}

/** Coleções, Faixa de preço and Rede, as one panel (desktop sidebar and mobile sheet). */
export function FiltersPanel({ search, facets, onChange, bare, className }: FiltersPanelProps) {
  return (
    <div className={cn('flex flex-col gap-10', !bare && 'bg-surface-card p-5', className)}>
      <FacetGroup
        title="Coleções"
        rows={facets?.categories}
        skeletonRows={9}
        selected={splitList(search.categories)}
        boldCount
        onToggle={(id) => {
          onChange({ categories: toggleInList(search.categories, id) })
        }}
      />
      <PriceFilter search={search} facets={facets} onChange={onChange} />
      <FacetGroup
        title="Rede"
        rows={facets?.networks}
        skeletonRows={3}
        selected={splitList(search.networks)}
        onToggle={(id) => {
          onChange({ networks: toggleInList(search.networks, id) })
        }}
      />
    </div>
  )
}

interface FacetRow {
  id: string
  label: string
  count: number
}

/**
 * A group of checkbox rows drawn as the Figma text rows (CAT-08). The native checkbox is visually
 * hidden and the row shows its state: accent color plus bold plus a check mark, so color is never
 * the only cue. Zero counts stay enabled: selecting one is valid and returns no results.
 */
function FacetGroup({
  title,
  rows,
  skeletonRows,
  selected,
  boldCount = false,
  onToggle,
}: {
  title: string
  rows: FacetRow[] | undefined
  skeletonRows: number
  selected: string[]
  boldCount?: boolean
  onToggle: (id: string) => void
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-3 text-title text-foreground">{title}</legend>
      <ul className="flex flex-col px-3">
        {rows
          ? rows.map((row) => {
              const checked = selected.includes(row.id)
              return (
                <li key={row.id}>
                  <label
                    className={cn(
                      'relative flex min-h-10 cursor-pointer items-center justify-between gap-3 text-body-md leading-10 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus',
                      checked ? 'font-bold text-text-accent' : 'text-text-secondary',
                    )}
                  >
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={checked}
                      onChange={() => {
                        onToggle(row.id)
                      }}
                    />
                    <span className="flex items-center gap-2">
                      <CheckIcon
                        className={cn('size-3.5 shrink-0 stroke-[2.5]', !checked && 'hidden')}
                      />
                      {row.label}
                    </span>
                    <span className={cn(boldCount || checked ? 'font-bold' : 'font-normal')}>
                      ({row.count})
                    </span>
                  </label>
                </li>
              )
            })
          : Array.from({ length: skeletonRows }, (_, index) => (
              <li key={index} className="flex h-10 items-center justify-between">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-8" />
              </li>
            ))}
      </ul>
    </fieldset>
  )
}

/**
 * Two-handle slider in 0.01 ETH steps. The draft lives here and reaches the URL only through
 * "Aplicar" (CAT-09); it restarts whenever the bounds or the applied prices change.
 */
function PriceFilter({
  search,
  facets,
  onChange,
}: Pick<FiltersPanelProps, 'search' | 'facets' | 'onChange'>) {
  const bounds = facets ? boundsFromFacets(facets.price) : null
  const key = `${String(bounds?.min)}-${String(bounds?.max)}-${search.minPrice ?? ''}-${search.maxPrice ?? ''}`
  return (
    <fieldset className="min-w-0">
      <legend className="mb-3 text-title text-foreground">Faixa de preço</legend>
      <div className="flex flex-col gap-3">
        {facets ? (
          <PriceDraft key={key} search={search} bounds={bounds} onChange={onChange} />
        ) : (
          <>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-9 w-20" />
          </>
        )}
      </div>
    </fieldset>
  )
}

function PriceDraft({
  search,
  bounds,
  onChange,
}: Pick<FiltersPanelProps, 'search' | 'onChange'> & {
  bounds: ReturnType<typeof boundsFromFacets>
}) {
  const range = bounds ?? { min: 0, max: 0 }
  const [draft, setDraft] = React.useState<StepRange>(() =>
    rangeFromSearch(range, search.minPrice, search.maxPrice),
  )
  const [low, high] = draft

  return (
    <>
      <Slider
        min={range.min}
        max={Math.max(range.max, range.min + 1)}
        step={1}
        minStepsBetweenThumbs={0}
        disabled={!bounds}
        value={[low, high]}
        thumbLabels={['Preço mínimo', 'Preço máximo']}
        thumbValueText={(value) => formatEth(fromSteps(value))}
        onValueChange={(value) => {
          const [nextLow, nextHigh] = value
          if (nextLow !== undefined && nextHigh !== undefined) setDraft([nextLow, nextHigh])
        }}
      />
      <p className="px-3 text-body-md text-foreground">
        {bounds
          ? `Preço: ${formatEthAmount(fromSteps(low))} - ${formatEthAmount(fromSteps(high))} ETH`
          : 'Sem preços para filtrar'}
      </p>
      <Button
        size="sm"
        disabled={!bounds}
        className="ml-3 h-9 w-fit px-3 font-bold"
        onClick={() => {
          if (bounds) onChange(pricesFromRange(bounds, draft))
        }}
      >
        Aplicar
      </Button>
    </>
  )
}
