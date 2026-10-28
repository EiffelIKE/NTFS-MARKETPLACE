import { Link } from '@tanstack/react-router'

import { PageContainer } from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'

/**
 * The "NFT não encontrado" view (DET-02): a nonexistent id, or an id that is not even shaped like
 * one. The URL stays as typed, so a reload tries again.
 */
export function NftNotFound() {
  return (
    <PageContainer className="flex flex-col items-start gap-4 py-10 lg:py-16">
      <title>NFT não encontrado · KURIO</title>
      <h1 className="text-heading text-foreground">NFT não encontrado</h1>
      <p className="text-body-lg text-text-secondary">
        O NFT que você procura não existe ou foi removido.
      </p>
      <Button asChild>
        <Link to="/" hash="mercado">
          Voltar ao mercado
        </Link>
      </Button>
    </PageContainer>
  )
}
