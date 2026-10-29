import { Link } from '@tanstack/react-router'
import * as React from 'react'

import { CloseIcon, ThankYouIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { useBottomBarInset } from '@/hooks/use-bottom-bar-inset'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

import type { ReceiptView } from '../model/receipt'
import { ReceiptLines, ReceiptTotals } from './receipt-lines'

const bandCell =
  'flex min-w-0 flex-col px-3 py-3 lg:whitespace-nowrap max-lg:border-primary max-lg:odd:border-r max-lg:nth-[n+3]:border-t lg:border-l lg:border-primary lg:first:border-l-0'

function SummaryBand({ view }: { view: ReceiptView }) {
  return (
    <dl
      data-testid="receipt-summary"
      className="grid grid-cols-2 border-y border-primary lg:grid-cols-[1.2fr_1.4fr_1fr_1fr]"
    >
      <div className={bandCell}>
        <dt className="text-caption-sm font-bold text-text-secondary lg:text-caption lg:font-bold">
          ID da transação
        </dt>
        <dd className="text-caption-sm text-text-secondary lg:text-caption lg:font-normal">
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                data-testid="receipt-hash"
                // The tooltip needs a focusable trigger (keyboard and touch users get the full hash).
                // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
                tabIndex={0}
                className="cursor-help rounded-xs"
              >
                {/* Assistive technology reads the full hash; the short one is only what is drawn. */}
                <span aria-hidden="true">{view.shortHash}</span>
                <span className="sr-only">{view.hash}</span>
              </span>
            </TooltipTrigger>
            <TooltipContent className="break-all">{view.hash}</TooltipContent>
          </Tooltip>
        </dd>
      </div>
      <div className={bandCell}>
        <dt className="text-caption-sm text-text-secondary lg:text-caption lg:font-normal">Data</dt>
        <dd
          data-testid="receipt-date"
          className="text-caption-sm text-text-secondary lg:text-caption lg:font-normal"
        >
          {view.date}
        </dd>
      </div>
      <div className={bandCell}>
        <dt className="text-caption-sm text-text-secondary lg:text-caption lg:font-normal">
          Total
        </dt>
        <dd
          data-testid="receipt-total"
          className="text-caption-sm text-text-secondary tabular-nums lg:text-caption lg:font-normal"
        >
          {view.total}
        </dd>
      </div>
      <div className={bandCell}>
        <dt className="text-caption-sm font-bold text-text-secondary lg:text-caption lg:font-bold">
          Carteira
        </dt>
        <dd className="text-caption-sm text-text-secondary lg:text-caption lg:font-normal">
          {view.wallet}
        </dd>
      </div>
    </dl>
  )
}

/**
 * "Ver no <explorer>" (RCPT-11). The simulated explorer is a page of this app, so it opens in the
 * same tab through the router: a new tab would reload and boot the whole app for a page that is
 * part of it, and the Back button brings the receipt back. An address outside the app (a stored
 * order from before the explorer existed) still leaves in a new tab and says so.
 */
function ExplorerLink({
  explorer,
  describedBy,
  ...props
}: { explorer: ReceiptView['explorer']; describedBy: string } & Omit<
  React.ComponentProps<'a'>,
  'href' | 'target' | 'rel'
>) {
  const { target, name } = explorer
  if (target.kind === 'internal') {
    return (
      <Link
        {...props}
        data-testid="explorer-link"
        to="/explorer/$network/tx/$txHash"
        params={{ network: target.network, txHash: target.hash }}
        aria-describedby={describedBy}
      >
        Ver no {name}
      </Link>
    )
  }
  return (
    <a
      {...props}
      data-testid="explorer-link"
      href={target.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-describedby={describedBy}
    >
      Ver no {name}
      <span className="sr-only"> (abre em nova aba)</span>
    </a>
  )
}

/**
 * The receipt (RCPT-08 – RCPT-16), built from `receiptView` alone. From `lg` it is the Figma modal
 * as a centered card (close button, accent bar); below it is a full-width page with the explorer
 * action in a fixed bottom bar, in the style of checkout. `focusOnMount` is for the moment the
 * receipt appears after a payment or replaces the processing panel.
 */
export function ReceiptCard({ view, focusOnMount }: { view: ReceiptView; focusOnMount: boolean }) {
  const heading = React.useRef<HTMLHeadingElement>(null)
  const bar = React.useRef<HTMLDivElement>(null)
  const captionId = React.useId()

  React.useEffect(() => {
    if (focusOnMount) heading.current?.focus()
  }, [focusOnMount])
  useBottomBarInset(bar)

  return (
    <div
      data-testid="receipt"
      className="relative mx-auto flex w-full max-w-150 flex-col pb-[var(--bottom-bar-inset,8.5rem)] lg:mt-10 lg:max-w-145 lg:bg-surface-card lg:pb-0"
    >
      <Link
        to="/"
        aria-label="Fechar"
        className="absolute top-5 right-5 z-10 hidden size-6 items-center justify-center rounded-xs text-primary hover:text-text-accent lg:flex"
      >
        <CloseIcon className="size-5" />
      </Link>

      <header className="flex flex-col items-center gap-4 pt-6 pb-6 text-center lg:pt-6 lg:pb-5">
        <ThankYouIcon aria-hidden="true" className="size-16 text-primary lg:size-20" />
        <h1
          ref={heading}
          tabIndex={-1}
          className="px-4 text-body-lg font-bold text-text-secondary outline-none"
        >
          Seus NFTs agora estão na sua carteira
        </h1>
      </header>

      <SummaryBand view={view} />

      <section aria-labelledby="receipt-details" className="px-0 pt-5 lg:px-11">
        <h2 id="receipt-details" className="mb-3 text-body-lg font-bold text-foreground">
          Detalhes da transação
        </h2>
        <ReceiptLines lines={view.lines} />
        <ReceiptTotals rows={view.totals} />
        <p
          data-testid="receipt-note"
          className="border-t border-border-soft pt-4 text-center text-body text-text-secondary"
        >
          {view.note}
        </p>
      </section>

      <div className="flex flex-col items-center gap-3 px-0 pt-5 pb-8 lg:px-11">
        <div
          ref={bar}
          className="max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-30 max-lg:bg-background max-lg:px-6 max-lg:pt-3 max-lg:pb-[calc(1rem+env(safe-area-inset-bottom))] max-lg:[@media(max-height:560px)]:static max-lg:[@media(max-height:560px)]:p-0"
        >
          <Button
            asChild
            className="h-12 px-8 max-lg:mx-auto max-lg:h-15 max-lg:w-full max-lg:max-w-150 max-lg:rounded-full max-lg:bg-primary-cta"
          >
            <ExplorerLink explorer={view.explorer} describedBy={captionId} />
          </Button>
        </div>
        <p id={captionId} className="text-center text-caption-sm text-text-secondary">
          Explorador simulado, dentro do KURIO.
        </p>
        <Link to="/" className="text-body-lg text-text-accent underline-offset-4 hover:underline">
          Continuar explorando
        </Link>
      </div>

      <div aria-hidden="true" className="hidden h-2.5 bg-primary lg:block" />
    </div>
  )
}
