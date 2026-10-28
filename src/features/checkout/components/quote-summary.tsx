import { NftImage } from '@/components/nft-image'
import { Skeleton } from '@/components/ui/skeleton'
import type { Cart, Eth, Quote } from '@/contracts'
import { formatEth } from '@/lib/money'
import { cn } from '@/lib/utils'

import type { AmountChange, QuoteDiff, TotalKey } from '../model/quote-review'

/**
 * An amount that may have changed (CHK-20): the old value struck through next to the new one in
 * the accent color, and a hidden sentence so the change is not carried by styling alone.
 */
function Amount({ value, change }: { value: Eth; change?: AmountChange | undefined }) {
  if (!change) return <>{formatEth(value)}</>
  return (
    <>
      <span className="sr-only">Antes {formatEth(change.from)}, agora </span>
      <del aria-hidden="true" className="mr-2 text-body font-normal text-text-secondary">
        {formatEth(change.from)}
      </del>
      <span data-changed="true">{formatEth(value)}</span>
    </>
  )
}

interface LinesProps {
  cart: Cart
  /** `undefined` while the quote loads: the lines keep their place, the amounts are skeletons. */
  quote: Quote | undefined
  diff?: QuoteDiff | null | undefined
  outdated?: boolean
}

/**
 * "Seus NFTs": one row per quoted line, with the cart line's picture and name and the quote's
 * amounts (CHK-12). Rows are 70 tall on `surface-card`, as in the cart and in Figma.
 */
export function QuoteLines({ cart, quote, diff, outdated }: LinesProps) {
  const rows = quote
    ? quote.lines.map((line) => ({ line, item: cart.items.find((i) => i.id === line.itemId) }))
    : cart.items.map((item) => ({ line: undefined, item }))

  return (
    <ul className="flex flex-col gap-3" aria-label="Seus NFTs">
      {rows.map(({ line, item }) => {
        const change = line ? diff?.lines.get(line.itemId) : undefined
        return (
          <li
            key={item?.id ?? line?.itemId}
            data-testid="quote-line"
            data-changed={change ? true : undefined}
            className="flex min-h-17.5 items-center gap-3 rounded-md bg-surface-card pr-3"
          >
            {item && (
              <NftImage
                image={item.image}
                slot="thumb"
                alt=""
                className="size-17.5 shrink-0 rounded-l-md object-cover"
              />
            )}
            <div className="flex min-w-0 flex-1 flex-col py-1">
              <p className="line-clamp-2 text-body-lg font-bold text-foreground">
                {item?.name ?? line?.nftId}
              </p>
              <p className="text-caption-sm text-text-secondary">
                ID do token: {item?.tokenId ?? ''}
              </p>
              <p className="text-caption-sm text-text-secondary">
                Edição: {item?.editionLabel ?? ''}
              </p>
            </div>
            <p className="shrink-0 text-body-lg text-text-secondary">
              (x{' '}
              {change?.quantity ? (
                <>
                  <del aria-hidden="true">{change.quantity.from}</del> {line?.quantity}
                </>
              ) : (
                (line?.quantity ?? item?.quantity)
              )}
              )
            </p>
            <div
              className={cn(
                'w-26 shrink-0 text-right text-body-lg font-bold text-text-accent tabular-nums',
                outdated && 'opacity-60',
              )}
            >
              {line ? (
                <Amount value={line.lineTotal} change={change?.lineTotal} />
              ) : (
                <Skeleton className="ml-auto h-5 w-20" />
              )}
            </div>
          </li>
        )
      })}
      {diff?.removed.map((line) => (
        <li
          key={line.itemId}
          data-testid="quote-line-removed"
          className="rounded-md bg-surface-card px-3 py-2 text-body text-text-secondary"
        >
          Um item saiu do pedido (quantidade {line.quantity}).
        </li>
      ))}
    </ul>
  )
}

const ROWS: { key: TotalKey; label: string; testId: string; prefix?: string }[] = [
  { key: 'subtotal', label: 'Subtotal', testId: 'quote-subtotal' },
  { key: 'discount', label: 'Desconto do lançamento', testId: 'quote-discount', prefix: '(-)' },
  { key: 'networkFee', label: 'Taxa de rede', testId: 'quote-fee' },
  { key: 'total', label: 'Total', testId: 'quote-total' },
]

interface AmountsProps {
  quote: Quote | undefined
  diff?: QuoteDiff | null | undefined
  /** Amounts of an earlier quote, or a refetch in flight: shown, dimmed (as the cart does). */
  outdated?: boolean
  className?: string
}

/** Subtotal, discount, network fee ("Taxa estimada") and total, every figure from the quote. */
export function QuoteAmounts({ quote, diff, outdated, className }: AmountsProps) {
  return (
    <dl
      className={cn('flex flex-col gap-3', className)}
      aria-busy={quote === undefined || outdated}
    >
      {ROWS.map((row) => {
        const strong = row.key === 'total'
        return (
          <div
            key={row.key}
            className={cn(
              'flex items-start justify-between gap-3',
              strong && 'border-t border-border pt-3',
            )}
          >
            <dt className={cn('text-body-lg text-foreground', strong && 'font-bold')}>
              {row.label}
              {row.key === 'discount' && quote?.coupon && (
                <span className="block text-caption-sm font-normal text-text-secondary">
                  Cupom {quote.coupon.code}
                </span>
              )}
            </dt>
            <dd className="flex min-w-32 flex-col items-end">
              <span
                data-testid={row.testId}
                data-outdated={outdated ? true : undefined}
                className={cn(
                  'flex min-h-6 items-center justify-end text-right text-body-lg tabular-nums transition-opacity',
                  strong ? 'font-bold text-text-accent' : 'text-foreground',
                  outdated && 'opacity-60',
                )}
              >
                {quote === undefined ? (
                  <Skeleton className="h-5 w-24" />
                ) : (
                  <>
                    {row.prefix && <span className="mr-1 text-body">{row.prefix}</span>}
                    <Amount value={quote[row.key]} change={diff?.totals[row.key]} />
                  </>
                )}
              </span>
              {row.key === 'networkFee' && (
                <span className="text-caption-sm text-text-accent">Taxa estimada</span>
              )}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}
