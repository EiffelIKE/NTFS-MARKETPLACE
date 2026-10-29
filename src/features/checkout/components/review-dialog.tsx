import { Link } from '@tanstack/react-router'
import * as React from 'react'

import { announce } from '@/components/feedback'
import { AlertCircleIcon } from '@/components/icons'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import {
  NETWORK_LABELS,
  WALLET_PROVIDER_LABELS,
  type CreateOrderBody,
  type Quote,
} from '@/contracts'
import { useAccountUserId } from '@/features/account/model/use-account'
import type { ApiError } from '@/lib/http/errors'
import { useMediaQuery } from '@/hooks/use-media-query'
import { useQueryClient } from '@tanstack/react-query'

import { markDisconnected, useWalletConnection } from '../api/use-wallet-connection'
import { useCreateOrder } from '../api/use-create-order'
import { toCreateOrderBody } from '../model/form'
import {
  detailShortages,
  diffQuotes,
  quoteNotes,
  quoteShortages,
  reviewPhase,
  shortageText,
  type Shortage,
} from '../model/quote-review'
import { useCheckoutContext } from './checkout-context'
import { QuoteAmounts, QuoteLines } from './quote-summary'
import { shortAddress } from '../model/format'

const CHANGED_MESSAGE = 'Os valores do pedido mudaram.'
const DISCONNECTED_MESSAGE = 'Sua carteira foi desconectada. Conecte novamente para pagar.'

interface ReviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** An order exists (created, or found by the API): the form is done (CHK-27, CHK-29). */
  onOrder: (orderId: string) => void
  /** The API refused fields of the form (CHK-08). */
  onInvalid: (error: ApiError) => void
}

/**
 * The review step (spec 09 design §5, CHK-18 – CHK-22): a dialog from `lg`, a full-height sheet
 * below it (open question 4). While a request is in flight, Esc, the backdrop and the close button
 * do nothing, so the dialog cannot be dismissed over an order that is being created.
 */
export function ReviewDialog(props: ReviewDialogProps) {
  const { open, onOpenChange } = props
  const wide = useMediaQuery('(min-width: 1024px)')
  const create = useCreateOrder()
  const busy = create.isPending
  const title = React.useRef<HTMLHeadingElement>(null)

  const guard = {
    onEscapeKeyDown: (event: Event) => {
      if (busy) event.preventDefault()
    },
    onInteractOutside: (event: Event) => {
      if (busy) event.preventDefault()
    },
    onOpenAutoFocus: (event: Event) => {
      event.preventDefault()
      title.current?.focus()
    },
    // The review is opened by a submit, not by a Radix trigger, so Radix does not know where to
    // return focus (CHK-36): it goes back to the form's own submit button, when it still exists.
    onCloseAutoFocus: (event: Event) => {
      const trigger = document.querySelector<HTMLElement>(
        'button[type="submit"][form="checkout-form"]',
      )
      if (!trigger) return
      event.preventDefault()
      trigger.focus()
    },
  }

  const body = (
    <ReviewBody
      {...props}
      create={create}
      titleRef={title}
      Title={wide ? DialogTitle : SheetTitle}
      Description={wide ? DialogDescription : SheetDescription}
      Header={wide ? DialogHeader : SheetHeader}
      Footer={wide ? DialogFooter : SheetFooter}
    />
  )

  return wide ? (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={!busy}
        className="max-w-[min(640px,calc(100vw-32px))]"
        {...guard}
      >
        {body}
      </DialogContent>
    </Dialog>
  ) : (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={!busy}
        className="h-dvh max-h-none rounded-none"
        {...guard}
      >
        {body}
      </SheetContent>
    </Sheet>
  )
}

type Slot = React.ComponentType<React.ComponentProps<'div'>>

interface BodyProps extends ReviewDialogProps {
  create: ReturnType<typeof useCreateOrder>
  titleRef: React.RefObject<HTMLHeadingElement | null>
  Title: React.ComponentType<React.ComponentProps<'h2'>>
  Description: React.ComponentType<React.ComponentProps<'p'>>
  Header: Slot
  Footer: Slot
}

type Submit = 'idle' | 'unknown'

/**
 * Review content. It mounts when the dialog opens, so every review starts clean: it asks the API
 * for the current quote, and that quote is what the user *accepts*. From then on the quote the
 * page holds can only differ by a new `id`, which turns payment off until the user has seen the
 * new values and accepted them (CHK-20).
 */
function ReviewBody({
  onOpenChange,
  onOrder,
  onInvalid,
  create,
  titleRef,
  Title,
  Description,
  Header,
  Footer,
}: BodyProps) {
  const queryClient = useQueryClient()
  const userId = useAccountUserId()
  const { cart, quote, values, wallet } = useCheckoutContext()
  const connection = useWalletConnection({
    walletId: values.walletId,
    provider: values.provider,
    network: values.network,
  })

  const [accepted, setAccepted] = React.useState<Quote | null>(null)
  const [loadFailed, setLoadFailed] = React.useState(false)
  const [submit, setSubmit] = React.useState<Submit>('idle')
  const [failure, setFailure] = React.useState<string | null>(null)
  const [shortages, setShortages] = React.useState<Shortage[]>([])
  const acceptRef = React.useRef<HTMLButtonElement>(null)
  const payRef = React.useRef<HTMLButtonElement>(null)

  // The quote of this review (CHK-18): asked for when the step opens, and joined when one is
  // already on its way, so the answer can never be an older one.
  const refetch = quote.refetch
  React.useEffect(() => {
    let live = true
    void refetch({ cancelRefetch: false }).then((result) => {
      if (!live) return
      if (result.data && !result.isError) setAccepted(result.data)
      else setLoadFailed(true)
    })
    return () => {
      live = false
    }
  }, [refetch])

  const current = quote.data
  const outdated = quote.isPlaceholderData || quote.isFetching
  const quotePhase = reviewPhase({ accepted, current })
  // An availability refusal blocks payment at once; the refetched quote then says the same.
  const phase = shortages.length > 0 && quotePhase !== 'loading' ? 'blocked' : quotePhase
  const diff =
    accepted && current && current.id !== accepted.id ? diffQuotes(accepted, current) : null

  // CHK-20: say it once per new quote, and put focus where the next action is.
  const changedId = phase === 'changed' ? current?.id : undefined
  React.useEffect(() => {
    if (!changedId) return
    announce(CHANGED_MESSAGE, 'assertive')
    acceptRef.current?.focus()
  }, [changedId])

  const lineShortages =
    shortages.length > 0
      ? shortages
      : current && !current.purchasable
        ? quoteShortages(current, cart.items)
        : []

  // After "Aceitar novos valores" the button is replaced by the pay button: focus follows it.
  const accepting = React.useRef(false)
  React.useEffect(() => {
    if (phase === 'ready' && accepting.current) {
      accepting.current = false
      payRef.current?.focus()
    }
  }, [phase])

  const pay = async () => {
    if (phase !== 'ready' || !connection.connected || accepted === null) return
    setFailure(null)
    setShortages([])
    let body: CreateOrderBody
    try {
      body = toCreateOrderBody(values, accepted.id)
    } catch {
      setFailure('Revise os dados do formulário antes de pagar.')
      return
    }
    const result = await create.submit(body)
    switch (result.kind) {
      case 'busy':
        return
      case 'created':
        onOrder(result.order.id)
        return
      case 'tracking':
        onOrder(result.orderId)
        return
      case 'quote-changed':
        setSubmit('idle')
        return
      case 'unavailable':
        setSubmit('idle')
        setShortages(detailShortages(result.lines, cart.items))
        return
      case 'wallet-disconnected':
        setSubmit('idle')
        if (userId) markDisconnected(queryClient, userId, values.walletId)
        setFailure(DISCONNECTED_MESSAGE)
        return
      case 'invalid':
        setSubmit('idle')
        onInvalid(result.error)
        return
      case 'session':
        setSubmit('idle')
        return
      case 'unknown':
        setSubmit('unknown')
        return
      case 'failed':
        setSubmit('idle')
        setFailure(result.error.message)
    }
  }

  const connectError = connection.connectError
  const rejected = connectError?.code === 'WALLET_REJECTED'
  const providerName = WALLET_PROVIDER_LABELS[values.provider]
  const busy = create.isPending
  const canPay = phase === 'ready' && connection.connected && !outdated && !busy
  const notes = current && accepted ? quoteNotes(current, cart.items) : []

  return (
    <>
      <Header>
        <Title ref={titleRef} tabIndex={-1} className="text-heading outline-none">
          Revise seu pedido
        </Title>
        <Description>Confira os valores, a carteira e a rede antes de pagar.</Description>
      </Header>

      <div className="flex flex-col gap-5" aria-busy={phase === 'loading' || outdated}>
        {loadFailed && (
          <Alert>
            <AlertCircleIcon />
            <AlertDescription>Não foi possível conferir os valores do pedido.</AlertDescription>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2 w-fit"
              onClick={() => {
                setLoadFailed(false)
                void refetch().then((result) => {
                  if (result.data && !result.isError) setAccepted(result.data)
                  else setLoadFailed(true)
                })
              }}
            >
              Tentar novamente
            </Button>
          </Alert>
        )}

        {phase === 'changed' && (
          <Alert variant="info" role="group" aria-label="Aviso" data-testid="quote-changed">
            <AlertCircleIcon />
            <AlertTitle>{CHANGED_MESSAGE}</AlertTitle>
            <AlertDescription>
              Confira o que mudou e aceite os novos valores para continuar.
            </AlertDescription>
          </Alert>
        )}

        {lineShortages.length > 0 && (
          <Alert data-testid="quote-blocked">
            <AlertCircleIcon />
            <AlertTitle>Alguns itens não estão mais disponíveis</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-5">
                {lineShortages.map((line) => (
                  <li key={`${line.nftId}:${line.editionId}`}>{shortageText(line)}</li>
                ))}
              </ul>
              <p className="mt-1">Ajuste o carrinho para continuar.</p>
            </AlertDescription>
          </Alert>
        )}

        {accepted === null && !loadFailed ? (
          <div aria-hidden="true" className="flex flex-col gap-3">
            {cart.items.map((item) => (
              <Skeleton key={item.id} className="h-17.5 w-full rounded-md" />
            ))}
            <Skeleton className="h-24 w-full rounded-md" />
          </div>
        ) : (
          current && (
            <>
              <QuoteLines cart={cart} quote={current} diff={diff} outdated={outdated} />
              <QuoteAmounts quote={current} diff={diff} outdated={outdated} />
            </>
          )
        )}

        {notes.length > 0 && (
          <ul
            className="flex flex-col gap-1 text-caption-sm text-text-secondary"
            data-testid="quote-notes"
          >
            {notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        )}

        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 border-t border-border pt-4 text-body">
          <dt className="text-text-secondary">Carteira</dt>
          <dd data-testid="review-wallet" className="text-right text-foreground">
            {wallet.nickname} · {shortAddress(wallet.address)}
          </dd>
          <dt className="text-text-secondary">Rede</dt>
          <dd data-testid="review-network" className="text-right text-foreground">
            {NETWORK_LABELS[values.network]}
          </dd>
          <dt className="text-text-secondary">Provedor</dt>
          <dd data-testid="review-provider" className="text-right text-foreground">
            {providerName}
          </dd>
        </dl>

        <section
          aria-label="Conexão da carteira"
          data-testid="wallet-connection"
          className="flex flex-col gap-3 rounded-md bg-surface-dark p-4"
        >
          {!connection.listReady && !connection.connected ? (
            <Skeleton className="h-10 w-full" />
          ) : connection.connected ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-body-lg font-bold text-foreground">
                <span className="text-text-accent">●</span> Conectada
                <span className="sr-only">: {providerName}</span>
              </p>
              <Button
                type="button"
                variant="link"
                loading={connection.disconnect.isPending}
                disabled={busy}
                onClick={() => {
                  if (connection.connection) connection.disconnect.mutate(connection.connection.id)
                }}
              >
                Desconectar
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-body-lg text-foreground">Carteira desconectada</p>
              <Button
                type="button"
                variant="secondary"
                loading={connection.connect.isPending}
                disabled={busy}
                onClick={() => {
                  connection.connect.mutate()
                }}
              >
                {connection.connect.isPending ? 'Conectando…' : `Conectar ${providerName}`}
              </Button>
            </div>
          )}
          {connectError && (
            <Alert>
              <AlertCircleIcon />
              <AlertDescription>
                {rejected ? 'A carteira recusou a conexão.' : connectError.message}
              </AlertDescription>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 w-fit"
                loading={connection.connect.isPending}
                onClick={() => {
                  connection.connect.mutate()
                }}
              >
                Tentar novamente
              </Button>
            </Alert>
          )}
        </section>

        {failure && (
          <Alert>
            <AlertCircleIcon />
            <AlertDescription>{failure}</AlertDescription>
          </Alert>
        )}

        {submit === 'unknown' && (
          <Alert data-testid="order-unknown">
            <AlertCircleIcon />
            <AlertTitle>Não conseguimos confirmar se o pedido foi criado.</AlertTitle>
            <AlertDescription>
              Ele pode ter sido registrado. Tentar novamente reenvia o mesmo pedido: você não paga
              duas vezes.
            </AlertDescription>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2 w-fit"
              loading={busy}
              onClick={() => {
                void pay()
              }}
            >
              Tentar novamente
            </Button>
          </Alert>
        )}
      </div>

      <Footer>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => {
            onOpenChange(false)
          }}
        >
          Editar dados
        </Button>
        {phase === 'blocked' && (
          <Button asChild variant="outline">
            <Link to="/cart">Voltar ao carrinho</Link>
          </Button>
        )}
        {phase === 'changed' ? (
          <Button
            ref={acceptRef}
            type="button"
            disabled={outdated}
            onClick={() => {
              if (!current) return
              accepting.current = true
              setAccepted(current)
            }}
          >
            Aceitar novos valores
          </Button>
        ) : (
          <Button
            ref={payRef}
            type="button"
            loading={busy}
            disabled={!canPay && !busy}
            onClick={() => {
              void pay()
            }}
          >
            Confirmar pagamento
          </Button>
        )}
      </Footer>
    </>
  )
}
