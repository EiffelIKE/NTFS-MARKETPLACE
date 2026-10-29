import { Button } from '@/components/ui/button'

interface BootErrorProps {
  error: unknown
}

/** Shown when the mock worker fails to start: the app never falls through to a missing backend. */
export function BootError({ error }: BootErrorProps) {
  const reason = error instanceof Error ? error.message : String(error)
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-bold">Não foi possível iniciar a simulação da API</h1>
      <p className="text-muted-foreground">
        O KURIO usa uma API simulada no navegador, que precisa de um service worker. Verifique se o
        navegador permite service workers e se a página abre em HTTPS ou em localhost.
      </p>
      <p className="text-sm break-words text-muted-foreground">{reason}</p>
      <Button
        onClick={() => {
          window.location.reload()
        }}
      >
        Recarregar página
      </Button>
    </main>
  )
}
