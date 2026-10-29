import { useSuspenseQuery } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'

import { CheckCircleIcon, DangerTriangleIcon, ScanIcon } from '@/components/icons'
import { PageContainer } from '@/components/layout/page-container'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { NetworkId } from '@/contracts'
import { cn } from '@/lib/utils'

import { explorerTxQuery } from '../api/explorer-queries'
import { explorerView, type ExplorerView } from '../model/explorer'

const route = getRouteApi('/explorer/$network/tx/$txHash')

/** One label and value of the transaction; stacked below `lg`, a two-column row from there. */
function Row({
  label,
  testId,
  mono,
  children,
}: {
  label: string
  testId?: string
  mono?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-border-soft py-3 last:border-b-0 lg:grid lg:grid-cols-[12rem_1fr] lg:gap-6">
      <dt className="text-body font-bold text-text-secondary">{label}</dt>
      <dd
        data-testid={testId}
        className={cn(
          'min-w-0 text-body-lg [overflow-wrap:anywhere] text-foreground',
          mono && 'font-mono text-body',
        )}
      >
        {children}
      </dd>
    </div>
  )
}

function Status({ status }: { status: ExplorerView['status'] }) {
  const Icon = status.value === 'confirmed' ? CheckCircleIcon : DangerTriangleIcon
  return (
    <span className="inline-flex items-center gap-2 font-bold">
      <Icon aria-hidden="true" className="size-5 text-text-accent" />
      {status.label}
    </span>
  )
}

function Items({ items }: { items: ExplorerView['items'] }) {
  return (
    <section aria-labelledby="explorer-items" className="flex flex-col gap-3">
      <h2 id="explorer-items" className="text-title text-foreground">
        Itens transferidos
      </h2>
      <table className="w-full max-lg:block">
        <caption className="sr-only">Tokens transferidos nesta transação</caption>
        <thead className="max-lg:sr-only">
          <tr className="border-b border-primary text-left text-body font-bold text-foreground">
            <th scope="col" className="pb-2 font-bold">
              Token
            </th>
            <th scope="col" className="w-32 pb-2 font-bold">
              Edição
            </th>
            <th scope="col" className="w-20 pb-2 text-right font-bold">
              Qtd.
            </th>
          </tr>
        </thead>
        <tbody className="max-lg:flex max-lg:flex-col max-lg:gap-3">
          {items.map((item) => (
            <tr
              key={item.key}
              data-testid="explorer-item"
              className="border-b border-border-soft last:border-b-0 max-lg:grid max-lg:grid-cols-[1fr_auto] max-lg:gap-x-4 max-lg:gap-y-0.5 max-lg:rounded-md max-lg:border max-lg:p-3"
            >
              <td className="py-3 pr-2 max-lg:col-span-1 max-lg:p-0">
                <span className="block text-body-lg font-bold text-foreground">{item.name}</span>
                <span className="block text-caption-sm text-text-secondary">
                  ID do token: {item.tokenId}
                </span>
              </td>
              <td className="py-3 text-body text-text-secondary max-lg:col-start-1 max-lg:p-0">
                <span className="sr-only lg:hidden">Edição: </span>
                {item.editionLabel}
              </td>
              <td className="py-3 text-right text-body-lg font-bold text-text-accent tabular-nums max-lg:col-start-2 max-lg:row-span-2 max-lg:row-start-1 max-lg:self-center max-lg:p-0">
                <span className="sr-only lg:hidden">Quantidade: </span>
                {item.quantity}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

/**
 * The simulated block explorer (spec 10 amendment): a KURIO page that shows only what a chain makes
 * public, read from `explorer.getTransaction`. The banner says plainly that it is a demonstration.
 */
export function ExplorerPage() {
  const params = route.useParams()
  // The loader already turned a network that does not exist into a 404.
  const { data } = useSuspenseQuery(explorerTxQuery(NetworkId.parse(params.network), params.txHash))
  const view = explorerView(data)

  return (
    <PageContainer className="flex flex-col gap-6 py-6 lg:py-10">
      <title>{`Transação ${view.hash.slice(0, 10)}… · KURIO`}</title>

      <Alert variant="info" data-testid="explorer-banner" className="max-w-3xl">
        <ScanIcon aria-hidden="true" />
        <AlertTitle>Explorador simulado — ambiente de demonstração</AlertTitle>
        <AlertDescription>
          Esta página imita um explorador de blocos ({view.explorerName}). Os dados vêm da simulação
          do KURIO e não existem em nenhuma rede real.
        </AlertDescription>
      </Alert>

      <div className="flex max-w-3xl flex-col gap-1">
        <p className="text-body font-bold text-text-accent">
          {view.explorerName} · {view.network}
        </p>
        <h1 className="text-heading text-foreground">Detalhes da transação</h1>
      </div>

      <div className="flex max-w-3xl flex-col gap-8 rounded-md bg-surface-card px-4 py-2 lg:px-6">
        <dl>
          <Row label="Hash da transação" testId="explorer-hash" mono>
            {view.hash}
          </Row>
          <Row label="Status" testId="explorer-status">
            <Status status={view.status} />
          </Row>
          <Row label="Rede">{view.network}</Row>
          <Row label="Bloco" testId="explorer-block">
            {view.block}
          </Row>
          <Row label="Data e hora" testId="explorer-time">
            {view.time}
          </Row>
          <Row label="De (carteira pagadora)" testId="explorer-from" mono>
            {view.from}
          </Row>
          <Row label="Para (contrato do marketplace)" testId="explorer-to" mono>
            {view.to}
          </Row>
          <Row label="Valor" testId="explorer-value">
            <span className="tabular-nums">{view.value}</span>
          </Row>
          <Row label="Taxa de rede" testId="explorer-fee">
            <span className="tabular-nums">{view.fee}</span>
          </Row>
        </dl>
      </div>

      <div className="max-w-3xl rounded-md bg-surface-card px-4 py-4 lg:px-6">
        <Items items={view.items} />
      </div>

      <Link
        to="/"
        hash="mercado"
        className="w-fit text-body-lg text-text-accent underline-offset-4 hover:underline"
      >
        Voltar ao mercado
      </Link>
    </PageContainer>
  )
}
