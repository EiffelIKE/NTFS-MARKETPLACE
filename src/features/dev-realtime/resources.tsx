import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { catalogApi, ordersApi } from '@/api'
import { useSession } from '@/features/auth/model/use-session'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { formatEth } from '@/lib/money'

import { Section } from '../ui-kit/section'

const ORDER_STATUS = { pending: 'pendente', confirmed: 'confirmado', declined: 'recusado' } as const

function Readout({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <p className="text-body text-foreground">
      <span className="text-text-secondary">{label}: </span>
      {children}
    </p>
  )
}

/** The cache entry spec 06 will use too (`['nfts', 'detail', id]`), so events patch it in place. */
export function NftSection() {
  const [id, setId] = useState('emerald-ape-042')
  const nft = useQuery({
    queryKey: ['nfts', 'detail', id],
    queryFn: ({ signal }) => catalogApi.get(id, { signal }),
    enabled: id.trim() !== '',
  })

  return (
    <Section id="nft" title="NFT" className="flex-col items-start">
      <Field className="w-72">
        <FieldLabel>ID do NFT</FieldLabel>
        <Input
          value={id}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => {
            setId(event.target.value.trim())
          }}
        />
      </Field>
      {nft.isError && <p role="alert">Não foi possível carregar o NFT.</p>}
      {nft.data && (
        <div aria-label="Dados do NFT" role="group" className="flex flex-col gap-1">
          <Readout label="Nome">{nft.data.name}</Readout>
          <Readout label="Preço">{formatEth(nft.data.price)}</Readout>
          <Readout label="Disponível">{nft.data.available ? 'sim' : 'não'}</Readout>
          <Readout label="Versão">{String(nft.data.version)}</Readout>
          <ul aria-label="Edições" className="flex flex-col gap-0.5 text-body">
            {nft.data.editions.map((edition) => (
              <li key={edition.id}>
                {edition.label}:{' '}
                {edition.available === null ? 'aberta' : `${String(edition.available)} restantes`}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Section>
  )
}

/** The cache entry spec 09 will use (`['orders', 'detail', id]`). Needs a signed-in session. */
export function OrderSection() {
  const [id, setId] = useState('')
  const session = useSession()
  const signedIn = session.status === 'authenticated'

  const order = useQuery({
    queryKey: ['orders', 'detail', id],
    queryFn: ({ signal }) => ordersApi.get(id, { signal }),
    enabled: id.trim() !== '' && signedIn,
    retry: false,
  })

  return (
    <Section id="pedido" title="Pedido" className="flex-col items-start">
      <Field className="w-72">
        <FieldLabel>ID do pedido</FieldLabel>
        <Input
          value={id}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => {
            setId(event.target.value.trim())
          }}
        />
      </Field>
      {!signedIn && <p className="text-body text-text-secondary">Entre para ver um pedido.</p>}
      {signedIn && id === '' && (
        <p className="text-body text-text-secondary">Informe o ID de um pedido.</p>
      )}
      {order.isError && <p role="alert">Não foi possível carregar o pedido.</p>}
      {order.data && (
        <div aria-label="Dados do pedido" role="group" className="flex flex-col gap-1">
          <Readout label="Status do pedido">{ORDER_STATUS[order.data.status]}</Readout>
          <Readout label="Versão do pedido">{String(order.data.version)}</Readout>
        </div>
      )}
    </Section>
  )
}
