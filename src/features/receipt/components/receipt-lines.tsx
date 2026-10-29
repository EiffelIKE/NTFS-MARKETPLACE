import { NftImage } from '@/components/nft-image'
import { cn } from '@/lib/utils'

import type { ReceiptLineView, ReceiptTotalRow } from '../model/receipt'

/**
 * "Detalhes da transação" (RCPT-08, RCPT-15): a real table at every width. Below `lg` the rows are
 * restyled as cards with `display` overrides, so the column headers stay in the accessibility tree
 * while the layout follows the mobile cart pattern (image left, quantity and total below the name).
 */
export function ReceiptLines({ lines }: { lines: ReceiptLineView[] }) {
  return (
    <table className="w-full max-lg:block">
      <caption className="sr-only">Itens da compra</caption>
      <thead className="max-lg:sr-only">
        <tr className="border-b border-primary text-left text-body-lg font-bold text-foreground">
          <th scope="col" className="pb-3 font-bold">
            NFTs
          </th>
          <th scope="col" className="w-24 pb-3 text-center font-bold">
            Edições
          </th>
          <th scope="col" className="w-32 pb-3 text-right font-bold">
            Subtotal
          </th>
        </tr>
      </thead>
      <tbody className="max-lg:flex max-lg:flex-col max-lg:gap-4">
        {lines.map((line) => (
          <tr
            key={line.key}
            data-testid="receipt-line"
            className="max-lg:grid max-lg:grid-cols-[4rem_1fr_auto] max-lg:items-center max-lg:gap-x-4 max-lg:gap-y-1"
          >
            <td className="py-3 pr-2 max-lg:contents">
              <div className="flex items-center gap-3 max-lg:contents">
                <NftImage
                  image={line.image}
                  slot="thumb"
                  // The name beside it already says what it is.
                  alt=""
                  className="size-17.5 shrink-0 rounded-artwork object-cover max-lg:row-span-2 max-lg:size-16"
                />
                <div className="flex min-w-0 flex-col max-lg:col-span-2">
                  <span className="text-body-lg font-bold text-foreground">{line.name}</span>
                  <span className="text-caption-sm text-text-secondary lg:text-body">
                    ID do token: {line.tokenId}
                  </span>
                  <span className="text-caption-sm text-text-secondary lg:text-body">
                    Edição: {line.editionLabel}
                  </span>
                </div>
              </div>
            </td>
            <td className="py-3 text-center text-body text-text-secondary tabular-nums max-lg:col-start-2 max-lg:p-0 max-lg:text-left">
              <span className="sr-only lg:hidden">Quantidade: </span>
              {line.quantity}
            </td>
            <td className="py-3 text-right text-body-lg font-bold text-text-accent tabular-nums max-lg:col-start-3 max-lg:p-0 lg:text-title">
              <span className="sr-only lg:hidden">Subtotal: </span>
              {line.total}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** Subtotal, discount (when there is one), network fee and total, right-aligned (RCPT-08). */
export function ReceiptTotals({ rows }: { rows: ReceiptTotalRow[] }) {
  return (
    <dl className="flex flex-col gap-1 py-4 lg:items-end">
      {rows.map((row) => {
        const strong = row.key === 'total'
        return (
          <div
            key={row.key}
            data-testid={`receipt-row-${row.key}`}
            className="flex w-full items-baseline justify-between gap-6 lg:w-80"
          >
            <dt
              className={cn('text-body-lg text-foreground lg:text-body-md', strong && 'font-bold')}
            >
              {row.label}
            </dt>
            <dd
              className={cn(
                'text-right text-body-lg tabular-nums lg:text-title',
                strong ? 'font-bold text-text-accent' : 'text-foreground lg:font-normal',
              )}
            >
              {row.value}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}
