import { Link, useRouter, type ErrorComponentProps } from '@tanstack/react-router'

import { AlertCircleIcon } from '@/components/icons'
import { PageContainer } from '@/components/layout/page-container'
import { NotFound } from '@/components/route-states'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { isApiError } from '@/lib/http/errors'

/** The card at its final width and about its final height, so the receipt arrives without a jump. */
export function ReceiptSkeleton() {
  return (
    <PageContainer className="px-6 lg:pt-10">
      <title>Pedido · KURIO</title>
      <h1 className="sr-only">Pedido</h1>
      <div
        role="status"
        aria-label="Carregando o pedido"
        className="mx-auto flex w-full max-w-150 flex-col items-center gap-6 py-6 lg:max-w-145 lg:bg-surface-card lg:px-11 lg:py-10"
      >
        <Skeleton className="size-16 rounded-md lg:size-20" />
        <Skeleton className="h-5 w-64 max-w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    </PageContainer>
  )
}

/** Someone else's order (RCPT-03): nothing about it is shown, not even that it exists. */
export function OrderForbidden() {
  return (
    <PageContainer className="flex flex-col items-start gap-4 py-10 lg:py-16">
      <title>Pedido indisponível · KURIO</title>
      <h1 className="text-heading text-foreground">Você não tem acesso a este pedido.</h1>
      <p className="text-body-lg text-text-secondary">
        Entre com a conta que fez a compra para ver o recibo.
      </p>
      <Button asChild>
        <Link to="/">Voltar ao início</Link>
      </Button>
    </PageContainer>
  )
}

/**
 * A load that failed for a reason other than "not found" or "forbidden" (RCPT-04). "Tentar
 * novamente" runs the loader again through the router; a 404 that shows up late (a refetch) gets
 * the not-found view.
 */
export function ReceiptError({ error, reset }: ErrorComponentProps) {
  const router = useRouter()
  if (isApiError(error, 'NOT_FOUND')) return <NotFound />

  return (
    <PageContainer className="flex flex-col items-start gap-6 py-10 lg:py-16">
      <title>Pedido · KURIO</title>
      <h1 className="sr-only">Pedido</h1>
      <Alert className="max-w-2xl">
        <AlertCircleIcon />
        <AlertTitle>Não foi possível carregar este pedido.</AlertTitle>
        <AlertDescription>
          {error instanceof Error ? error.message : 'Tente novamente em instantes.'}
        </AlertDescription>
        <AlertAction>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              reset()
              void router.invalidate()
            }}
          >
            Tentar novamente
          </Button>
        </AlertAction>
      </Alert>
    </PageContainer>
  )
}
