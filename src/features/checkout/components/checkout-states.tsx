import { Link } from '@tanstack/react-router'

import { AlertCircleIcon, BagIcon, SpinnerIcon, WalletIcon } from '@/components/icons'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import type { ApiError } from '@/lib/http/errors'

function Gate({
  icon,
  title,
  text,
  children,
  id,
}: {
  icon: React.ReactNode
  title: string
  text?: string
  children?: React.ReactNode
  id: string
}) {
  return (
    <section
      aria-labelledby={id}
      className="mx-auto flex max-w-sm flex-col items-center gap-4 py-16 text-center"
    >
      {icon}
      <div className="flex flex-col gap-1">
        <h2 id={id} className="text-title font-bold text-foreground">
          {title}
        </h2>
        {text && <p className="text-body text-text-secondary">{text}</p>}
      </div>
      {children}
    </section>
  )
}

/** "Seu carrinho está vazio" (CHK-02): no form, no submit, a way back to the catalog. */
export function CheckoutEmpty() {
  return (
    <Gate
      id="checkout-empty-title"
      icon={<BagIcon className="size-12 text-secondary" />}
      title="Seu carrinho está vazio"
      text="Adicione NFTs ao carrinho para finalizar uma compra."
    >
      <Button asChild>
        <Link to="/" hash="mercado">
          Explorar NFTs
        </Link>
      </Button>
    </Gate>
  )
}

/** "Cadastre uma carteira para finalizar a compra" (CHK-03): payments use registered wallets. */
export function CheckoutNoWallet() {
  return (
    <Gate
      id="checkout-no-wallet-title"
      icon={<WalletIcon className="size-12 text-secondary" />}
      title="Cadastre uma carteira para finalizar a compra"
      text="O pagamento usa uma carteira cadastrada na sua conta."
    >
      <Button asChild>
        <Link to="/wallets">Cadastrar carteira</Link>
      </Button>
    </Gate>
  )
}

/** A stored attempt is being replayed to learn whether its order exists (CHK-26). */
export function CheckoutChecking() {
  return (
    <section
      aria-labelledby="checkout-checking-title"
      className="mx-auto flex max-w-sm flex-col items-center gap-4 py-16 text-center"
    >
      <SpinnerIcon className="size-10 text-text-accent motion-reduce:animate-none" />
      <h2 id="checkout-checking-title" role="status" className="text-title text-foreground">
        Verificando seu pedido anterior…
      </h2>
    </section>
  )
}

/** The replay could not reach the server either: the order may exist (CHK-25). */
export function CheckoutUnknown({ error, onRetry }: { error: ApiError; onRetry: () => void }) {
  return (
    <Alert className="mx-auto max-w-xl" data-testid="order-unknown">
      <AlertCircleIcon />
      <AlertTitle>Não conseguimos confirmar se o seu pedido anterior foi criado.</AlertTitle>
      <AlertDescription>
        {error.message} Tentar novamente reenvia o mesmo pedido: você não paga duas vezes.
      </AlertDescription>
      <AlertAction>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Tentar novamente
        </Button>
      </AlertAction>
    </Alert>
  )
}

/** A region that failed to load, with its own retry (CHK-04). */
export function RegionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Alert>
      <AlertCircleIcon />
      <AlertDescription>{message}</AlertDescription>
      <AlertAction>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Tentar novamente
        </Button>
      </AlertAction>
    </Alert>
  )
}
