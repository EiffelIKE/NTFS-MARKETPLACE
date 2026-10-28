import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import { catalogApi, ordersApi } from '@/api'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { formatEth } from '@/lib/money'
import { http } from '@/lib/http/client'

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

/** The cache entry spec 09 will use (`['orders', 'detail', id]`). Needs the test token. */
export function OrderSection({ token }: { token: string | null }) {
  const [id, setId] = useState('')

  // Until spec 04's interceptor exists, the page sends the test token itself.
  useEffect(() => {
    if (!token) return
    const interceptor = http.interceptors.request.use((config) => {
      config.headers.set('Authorization', `Bearer ${token}`)
      return config
    })
    return () => {
      http.interceptors.request.eject(interceptor)
    }
  }, [token])

  const order = useQuery({
    queryKey: ['orders', 'detail', id],
    queryFn: ({ signal }) => ordersApi.get(id, { signal }),
    enabled: id.trim() !== '' && token !== null,
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
      {token === null && <p className="text-body text-text-secondary">Conecte com um token.</p>}
      {token !== null && id === '' && (
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
