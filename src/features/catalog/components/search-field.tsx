import * as React from 'react'

import { SearchIcon } from '@/components/icons'
import { cn } from '@/lib/utils'

import { useCatalogSearch } from '../model/use-catalog-search'

const DEBOUNCE_MS = 300

/**
 * The mobile top search field (`#catalog-search`, the tab bar button focuses it). Typing updates
 * `q` after a 300 ms pause and replaces the current history entry instead of pushing one per
 * keystroke; Enter applies at once (CAT-05). The text is the field's own while typing and follows
 * the URL when it changes from elsewhere (back, "Limpar filtros").
 */
export function SearchField({ className }: { className?: string }) {
  const { search, change } = useCatalogSearch()
  const [text, setText] = React.useState(search.q ?? '')
  const [syncedQ, setSyncedQ] = React.useState(search.q)

  if (search.q !== syncedQ) {
    setSyncedQ(search.q)
    // A change the field made itself (`q` is the trimmed text) must not rewrite what is typed.
    if (search.q !== (text.trim() || undefined)) setText(search.q ?? '')
  }

  const apply = React.useEffectEvent((value: string) => {
    const next = value.trim() || undefined
    if (next !== search.q) change({ q: next }, { replace: true })
  })

  React.useEffect(() => {
    const timer = setTimeout(() => {
      apply(text)
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [text])

  return (
    <form
      role="search"
      className={cn('min-w-0 flex-1', className)}
      onSubmit={(event) => {
        event.preventDefault()
        apply(text)
      }}
    >
      <label className="flex h-11.25 items-center gap-2 rounded-input-mobile bg-surface-card pl-3 text-body font-bold text-secondary focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus">
        <SearchIcon className="size-5.5 shrink-0 text-secondary" />
        <span className="sr-only">Buscar NFTs</span>
        <input
          id="catalog-search"
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          maxLength={80}
          placeholder="Explorar coleções"
          value={text}
          onChange={(event) => {
            setText(event.target.value)
          }}
          className="h-full min-w-0 flex-1 bg-transparent pr-3 text-foreground outline-none placeholder:text-secondary"
        />
      </label>
    </form>
  )
}
