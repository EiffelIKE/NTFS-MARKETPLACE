import { Link, useRouter, type ErrorComponentProps } from '@tanstack/react-router'

// Unstyled placeholders; spec 01 applies the design system.

export function NotFound() {
  return (
    <main>
      <title>Página não encontrada · KURIO</title>
      <h1>Página não encontrada</h1>
      <p>O endereço que você acessou não existe ou foi removido.</p>
      <Link to="/">Voltar ao início</Link>
    </main>
  )
}

export function RouteError({ error }: ErrorComponentProps) {
  const router = useRouter()
  return (
    <main>
      <title>Algo deu errado · KURIO</title>
      <h1>Algo deu errado</h1>
      <p>Não foi possível carregar esta página. Tente novamente em instantes.</p>
      {import.meta.env.DEV && <pre>{error instanceof Error ? error.message : String(error)}</pre>}
      <button type="button" onClick={() => void router.invalidate()}>
        Tentar novamente
      </button>
      <button
        type="button"
        onClick={() => {
          window.location.reload()
        }}
      >
        Recarregar página
      </button>
    </main>
  )
}
