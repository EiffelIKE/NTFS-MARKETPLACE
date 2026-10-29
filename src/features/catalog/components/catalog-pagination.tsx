import { Link } from '@tanstack/react-router'

import { ArrowLeftIcon, ChevronRightIcon } from '@/components/icons'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'

import { pageWindow } from '../model/page-window'
import { withPage, type CatalogSearch } from '../model/search'

/**
 * Numbered pagination below the grid (CAT-11). Pages are real links, so middle-click and copy-link
 * work; hidden when there is only one page. `onNavigate` fires before the router handles a click,
 * so the section knows the page change came from here and moves focus to the heading.
 */
export function CatalogPagination({
  page,
  totalPages,
  onNavigate,
}: {
  page: number
  totalPages: number
  onNavigate: () => void
}) {
  if (totalPages <= 1) return null
  const link = (target: number) =>
    ({
      to: '/',
      search: (prev: CatalogSearch) => withPage(prev, target),
      resetScroll: false,
      // The current page's link changes nothing, so it must not arm the focus move.
      ...(target !== page && { onClick: onNavigate }),
    }) as const

  return (
    <Pagination className="lg:justify-end">
      <PaginationContent>
        {page > 1 && (
          <PaginationItem>
            <PaginationPrevious asChild>
              <Link {...link(page - 1)}>
                <ArrowLeftIcon />
              </Link>
            </PaginationPrevious>
          </PaginationItem>
        )}
        {pageWindow(page, totalPages).map((entry, index) => (
          <PaginationItem key={entry ?? `gap-${String(index)}`}>
            {entry === null ? (
              <PaginationEllipsis />
            ) : (
              <PaginationLink asChild isActive={entry === page}>
                <Link {...link(entry)} aria-label={`Página ${String(entry)}`}>
                  {entry}
                </Link>
              </PaginationLink>
            )}
          </PaginationItem>
        ))}
        {page < totalPages && (
          <PaginationItem>
            <PaginationNext asChild>
              <Link {...link(page + 1)}>
                <ChevronRightIcon />
              </Link>
            </PaginationNext>
          </PaginationItem>
        )}
      </PaginationContent>
    </Pagination>
  )
}
