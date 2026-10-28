import { Skeleton } from '@/components/ui/skeleton'

function FieldSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-5.5 w-36" />
      <Skeleton className="h-10 w-full max-lg:h-12.5 max-lg:rounded-input-mobile" />
    </div>
  )
}

/**
 * The checkout's first load at its final geometry (CHK-04): the form grid and the summary column
 * from `lg`, the wallet cards and provider rows below it. Both are in the DOM and one is hidden
 * with CSS, so nothing is measured or switched while data is still arriving.
 */
export function CheckoutSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="hidden items-start gap-x-8 lg:grid lg:grid-cols-[minmax(0,1fr)_25.3125rem]">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-6 w-52" />
          <div className="grid grid-cols-2 gap-x-6 gap-y-5">
            {Array.from({ length: 10 }, (_, index) => (
              <FieldSkeleton key={index} />
            ))}
          </div>
          <Skeleton className="h-37.5 w-87.5" />
        </div>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-6 w-28" />
          {Array.from({ length: 2 }, (_, index) => (
            <Skeleton key={index} className="h-17.5 w-full rounded-md" />
          ))}
          <Skeleton className="h-32 w-full rounded-md" />
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-11.25 w-full" />
          ))}
          <Skeleton className="h-11 w-full" />
        </div>
      </div>

      <div className="flex flex-col gap-4 pt-2 lg:hidden">
        <Skeleton className="h-6 w-44" />
        {Array.from({ length: 2 }, (_, index) => (
          <Skeleton key={index} className="h-27 w-full rounded-artwork-mobile" />
        ))}
        <Skeleton className="h-6 w-36" />
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-15 w-full rounded-artwork-mobile" />
        ))}
      </div>
    </div>
  )
}
