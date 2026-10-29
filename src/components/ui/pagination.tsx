import { Slot } from 'radix-ui'
import type * as React from 'react'

import { ArrowLeftIcon, ChevronRightIcon, MoreHorizontalIcon } from '@/components/icons'
import { cn } from '@/lib/utils'

function Pagination({ className, ...props }: React.ComponentProps<'nav'>) {
  return (
    <nav
      aria-label="Paginação"
      data-slot="pagination"
      className={cn('flex w-full justify-center', className)}
      {...props}
    />
  )
}

function PaginationContent({ className, ...props }: React.ComponentProps<'ul'>) {
  return (
    <ul
      data-slot="pagination-content"
      className={cn('flex flex-wrap items-center gap-2', className)}
      {...props}
    />
  )
}

function PaginationItem(props: React.ComponentProps<'li'>) {
  return <li data-slot="pagination-item" {...props} />
}

const linkClasses =
  "flex size-8.75 cursor-pointer items-center justify-center rounded-xs border border-border text-title font-normal text-foreground hover:bg-surface-dark aria-disabled:pointer-events-none aria-disabled:text-disabled [&_svg:not([class*='size-'])]:size-3.5"

/** Current page: primary fill, bold weight and `aria-current` (DS-08). Use `asChild` for router links. */
function PaginationLink({
  className,
  isActive,
  asChild = false,
  ...props
}: React.ComponentProps<'a'> & { isActive?: boolean; asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'a'
  return (
    <Comp
      aria-current={isActive ? 'page' : undefined}
      data-slot="pagination-link"
      data-active={isActive ? true : undefined}
      className={cn(
        linkClasses,
        isActive && 'border-primary bg-primary font-bold text-ink hover:bg-primary',
        className,
      )}
      {...props}
    />
  )
}

function PaginationPrevious({
  className,
  children,
  ...props
}: React.ComponentProps<typeof PaginationLink>) {
  return (
    <PaginationLink aria-label="Página anterior" className={className} {...props}>
      {children ?? <ArrowLeftIcon />}
    </PaginationLink>
  )
}

function PaginationNext({
  className,
  children,
  ...props
}: React.ComponentProps<typeof PaginationLink>) {
  return (
    <PaginationLink aria-label="Próxima página" className={className} {...props}>
      {children ?? <ChevronRightIcon />}
    </PaginationLink>
  )
}

function PaginationEllipsis({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="pagination-ellipsis"
      className={cn('flex size-8.75 items-center justify-center text-text-secondary', className)}
      {...props}
    >
      <MoreHorizontalIcon className="size-4" />
      <span className="sr-only">Mais páginas</span>
    </span>
  )
}

export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
}
