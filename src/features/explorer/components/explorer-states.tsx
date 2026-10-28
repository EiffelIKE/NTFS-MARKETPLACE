import { getRouteApi, Link, useRouter, type ErrorComponentProps } from '@tanstack/react-router'

import { AlertCircleIcon } from '@/components/icons'
import { PageContainer } from '@/components/layout/page-container'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { isApiError } from '@/lib/http/errors'

const route = getRouteApi('/explorer/$network/tx/$txHash')

/** The page's own shape (banner, heading, two cards), so the transaction arrives without a jump. */
export function ExplorerSkeleton() {
  return (
    <PageContainer className="py-6 lg:py-10">
      <title>Transação · KURIO</title>
      <h1 className="sr-only">Transação</h1>
      <div
        role="status"
        aria-label="Carregando a transação"
        className="flex max-w-3xl flex-col gap-6"
      >
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-10 w-72 max-w-full" />
        <Skeleton className="h-96 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    </PageContainer>
  )
}

/** An unknown hash, a hash on another network, or a network that does not exist. */
export function TransactionNotFound() {
  const { network, txHash } = route.useParams()
  return (
    <PageContainer className="flex max-w-3xl flex-col items-start gap-4 py-10 lg:py-16">
      <title>Transação não encontrada · KURIO</title>
      <Alert variant="info" className="max-w-3xl">
        <AlertCircleIcon aria-hidden="true" />
        <AlertTitle>Explorador simulado — ambiente de demonstração</AlertTitle>
      </Alert>
      <h1 className="text-heading text-foreground">Transação não encontrada</h1>
      <p className="text-body-lg text-text-secondary">
        Não há nenhuma transação com este hash na rede informada.
      </p>
      <p className="max-w-full font-mono text-body break-all text-text-secondary">
        {network} · {txHash}
      </p>
      <Button asChild>
        <Link to="/" hash="mercado">
          Voltar ao mercado
        </Link>
      </Button>
    </PageContainer>
  )
}

/** A load that failed for a reason other than "not found"; "Tentar novamente" re-runs the loader. */
export function ExplorerError({ error, reset }: ErrorComponentProps) {
  const router = useRouter()
  if (isApiError(error, 'NOT_FOUND')) return <TransactionNotFound />

  return (
    <PageContainer className="flex flex-col items-start gap-6 py-10 lg:py-16">
      <title>Transação indisponível · KURIO</title>
      <h1 className="sr-only">Transação indisponível</h1>
      <Alert className="max-w-2xl">
        <AlertCircleIcon />
        <AlertTitle>Não foi possível carregar esta transação.</AlertTitle>
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
