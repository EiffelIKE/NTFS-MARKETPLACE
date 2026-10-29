import { Link, useRouter, type ErrorComponentProps } from '@tanstack/react-router'

import { AlertCircleIcon } from '@/components/icons'
import { PageContainer } from '@/components/layout/page-container'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { isApiError } from '@/lib/http/errors'

import { NftNotFound } from './nft-not-found'

/**
 * A details load that failed for a reason other than "not found" (DET-03). "Tentar novamente"
 * runs the loader again through the router, without a page reload. A 404 that shows up after the
 * page was open (the NFT was removed, or a refetch said so) gets the not-found view.
 */
export function DetailsError({ error, reset }: ErrorComponentProps) {
  const router = useRouter()
  if (isApiError(error, 'NOT_FOUND')) return <NftNotFound />

  return (
    <PageContainer className="flex flex-col items-start gap-6 py-10 lg:py-16">
      <title>NFT indisponível · KURIO</title>
      <h1 className="sr-only">NFT indisponível</h1>
      <Alert className="max-w-2xl">
        <AlertCircleIcon />
        <AlertTitle>Não foi possível carregar este NFT.</AlertTitle>
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
      <Button asChild variant="secondary">
        <Link to="/" hash="mercado">
          Voltar ao mercado
        </Link>
      </Button>
    </PageContainer>
  )
}
