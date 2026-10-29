import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { resetMockWorkerAndReload } from '@/lib/mock-recovery'

interface BootErrorProps {
  error: unknown
}

/**
 * Shown when the mock worker fails to start, or goes away after a start: the app never falls
 * through to a missing backend. The button removes the stale worker registration before it
 * reloads; a plain reload would keep the dead worker that caused the failure.
 */
export function BootError({ error }: BootErrorProps) {
  const reason = error instanceof Error ? error.message : String(error)
  const [recovering, setRecovering] = useState(false)
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-bold">Não foi possível iniciar a simulação da API</h1>
      <p className="text-muted-foreground">
        O KURIO usa uma API simulada no navegador, que precisa de um service worker. Verifique se o
        navegador permite service workers e se a página abre em HTTPS ou em localhost.
      </p>
      <p className="text-sm break-words text-muted-foreground">{reason}</p>
      <p className="text-sm text-muted-foreground">
        Se isso aconteceu após uma auditoria Lighthouse, feche o DevTools e tente recarregar. Se
        continuar, em Application → Service Workers, desative “Bypass for network”.
      </p>
      <p className="text-sm text-muted-foreground">
        Se ainda assim não funcionar, limpe os dados do site, principalmente os service workers: no
        DevTools, Application → Storage → “Clear site data”, ou nas configurações do site no
        navegador. Depois, recarregue a página.
      </p>
      <Button
        loading={recovering}
        onClick={() => {
          setRecovering(true)
          void resetMockWorkerAndReload()
        }}
      >
        Recarregar página
      </Button>
    </main>
  )
}
