import { AlertCircleIcon } from '@/components/icons'
import { Alert, AlertAction, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

import { accountGrid } from './account-styles'

/** A failed load (ACC-21): the reason and a retry, inline where the form would be. */
export function LoadError({
  message,
  onRetry,
  className,
}: {
  message: string
  onRetry: () => void
  className?: string
}) {
  return (
    <Alert className={className}>
      <AlertCircleIcon />
      <AlertDescription>Não foi possível carregar seus dados. {message}</AlertDescription>
      <AlertAction>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Tentar novamente
        </Button>
      </AlertAction>
    </Alert>
  )
}

/** A label and an input at the size of the real field, so nothing moves when the data arrives. */
function FieldSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Skeleton className="h-5.5 w-36" />
      <Skeleton className="h-10 w-full max-lg:h-12.5 max-lg:rounded-input-mobile" />
    </div>
  )
}

function ButtonSkeleton() {
  return <Skeleton className="h-10 w-32.75 max-lg:h-15 max-lg:w-full max-lg:rounded-input-mobile" />
}

/** The profile form's shape (ACC-21). */
export function ProfileSkeleton() {
  return (
    <div className="flex flex-col gap-10">
      <div className={accountGrid}>
        <FieldSkeleton />
        <FieldSkeleton />
        <FieldSkeleton />
        <FieldSkeleton />
        <FieldSkeleton />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5.5 w-16" />
          <Skeleton className="size-12.5 rounded-full" />
        </div>
      </div>
      <div className="flex flex-col gap-6 md:max-w-[calc(50%-0.875rem)]">
        <Skeleton className="h-6 w-40" />
        <FieldSkeleton />
        <FieldSkeleton />
        <FieldSkeleton />
      </div>
      <ButtonSkeleton />
    </div>
  )
}

/** The wallets screen's shape: the primary form and the secondary header (ACC-21). */
export function WalletsSkeleton() {
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-5.5 w-full max-w-lg" />
        </div>
        <div className={accountGrid}>
          {Array.from({ length: 10 }, (_, index) => (
            <FieldSkeleton key={index} />
          ))}
        </div>
        <ButtonSkeleton />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-5.5 w-72" />
      </div>
    </div>
  )
}
