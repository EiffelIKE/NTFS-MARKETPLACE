import { Skeleton } from '@/components/ui/skeleton'

/** Two lines at the final row height (70 on desktop), for the cart's first load (CART-23). */
export function CartTableSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-3">
      <div className="flex items-center gap-4 border-b border-border pb-3">
        <Skeleton className="h-5 w-12" />
      </div>
      {Array.from({ length: 2 }, (_, index) => (
        <Skeleton key={index} className="h-17.5 w-full rounded-md" />
      ))}
    </div>
  )
}

/** Two cards at the final height (100 on mobile). */
export function CartCardsSkeleton() {
  return (
    <ul aria-hidden="true" className="flex flex-col gap-5">
      {Array.from({ length: 2 }, (_, index) => (
        <li key={index}>
          <Skeleton className="h-25 w-full rounded-card-mobile" />
        </li>
      ))}
    </ul>
  )
}
