import type { ConfigPatch } from './config'
import type { SeedId } from './db/state'

// The named scenarios (spec 02 §10). Each one maps to a brief §6 bullet; selecting one reseeds the
// database and clears runtime overrides, so the same scenario always behaves the same way.

export type ScenarioId =
  | 'default'
  | 'empty'
  | 'slow'
  | 'jitter'
  | 'out-of-order'
  | 'offline'
  | 'errors-then-recover'
  | 'server-down'
  | 'session-short'
  | 'payment-declined'
  | 'payment-manual'
  | 'pending-order'
  | 'order-timeout'
  | 'price-change-on-checkout'
  | 'sold-out-on-checkout'
  | 'wallet-reject'

export interface Scenario {
  id: ScenarioId
  label: string
  description: string
  seed: SeedId
  config: ConfigPatch
}

const unavailable = (op: NonNullable<ConfigPatch['rules']>[number]['op']) =>
  ({
    op,
    effect: { kind: 'http', status: 503, code: 'SERVICE_UNAVAILABLE' },
    // 3 failures exhaust the 2 query retries; the next attempt succeeds.
    times: 3,
  }) as const

const list: Scenario[] = [
  {
    id: 'default',
    label: 'Padrão',
    description: 'Tudo funciona, com latência de 120 ms. É o cenário da auditoria Lighthouse.',
    seed: 'default',
    config: {},
  },
  {
    id: 'empty',
    label: 'Catálogo vazio',
    description: 'Nenhum NFT no catálogo, para o estado de resultado vazio.',
    seed: 'empty-catalog',
    config: {},
  },
  {
    id: 'slow',
    label: 'Rede lenta',
    description: 'Toda resposta demora 2,5 s, para ver skeletons e estados de carregamento.',
    seed: 'default',
    config: { latency: { kind: 'fixed', ms: 2500 } },
  },
  {
    id: 'jitter',
    label: 'Latência variável',
    description: 'Respostas entre 150 ms e 2,5 s, sempre na mesma sequência.',
    seed: 'default',
    config: { latency: { kind: 'range', minMs: 150, maxMs: 2500 } },
  },
  {
    id: 'out-of-order',
    label: 'Respostas fora de ordem',
    description: 'Na listagem de NFTs, a segunda chamada responde antes da primeira.',
    seed: 'default',
    config: { outOfOrder: { ops: ['nfts.list'], slowMs: 1800, fastMs: 200 } },
  },
  {
    id: 'offline',
    label: 'Sem conexão',
    description: 'Toda chamada falha como se não houvesse rede.',
    seed: 'default',
    config: { rules: [{ op: '*', effect: { kind: 'network-error' }, times: 'always' }] },
  },
  {
    id: 'errors-then-recover',
    label: 'Falhas temporárias',
    description: 'Catálogo, detalhe, carrinho e destaques falham 3 vezes com 503 e depois voltam.',
    seed: 'default',
    config: {
      rules: [
        unavailable('nfts.list'),
        unavailable('nfts.get'),
        unavailable('cart.get'),
        unavailable('highlights.get'),
      ],
    },
  },
  {
    id: 'server-down',
    label: 'Servidor indisponível',
    description: 'Toda chamada responde 500.',
    seed: 'default',
    config: {
      rules: [
        { op: '*', effect: { kind: 'http', status: 500, code: 'INTERNAL' }, times: 'always' },
      ],
    },
  },
  {
    id: 'session-short',
    label: 'Sessão curta',
    description: 'A sessão expira 60 s depois do login.',
    seed: 'default',
    config: { sessionTtlMs: 60_000 },
  },
  {
    id: 'payment-declined',
    label: 'Pagamento recusado',
    description: 'Pedidos são recusados 3 s depois de criados.',
    seed: 'default',
    config: { payment: { outcome: 'decline' } },
  },
  {
    id: 'payment-manual',
    label: 'Pagamento manual',
    description:
      'Pedidos ficam pendentes até serem liquidados pelo painel ou por `__mock.settleOrder`.',
    seed: 'default',
    config: { payment: { outcome: 'manual' } },
  },
  {
    id: 'pending-order',
    label: 'Pedido pendente',
    description: 'A Ana já tem um pedido pendente, para testar a recuperação.',
    seed: 'pending-order',
    config: { payment: { outcome: 'manual' } },
  },
  {
    id: 'order-timeout',
    label: 'Timeout após criar pedido',
    description: 'A primeira criação de pedido é gravada, mas a resposta nunca chega.',
    seed: 'default',
    config: {
      rules: [{ op: 'orders.create', effect: { kind: 'timeout', phase: 'after' }, times: 1 }],
    },
  },
  {
    id: 'price-change-on-checkout',
    label: 'Preço muda no checkout',
    description: 'O preço do primeiro item do carrinho sobe 10% ao confirmar o pedido.',
    seed: 'default',
    config: { checkoutTrigger: 'raise-price' },
  },
  {
    id: 'sold-out-on-checkout',
    label: 'Esgota no checkout',
    description: 'O primeiro item do carrinho esgota ao confirmar o pedido.',
    seed: 'default',
    config: { checkoutTrigger: 'sell-out' },
  },
  {
    id: 'wallet-reject',
    label: 'Carteira recusa conexão',
    description: 'A conexão com a carteira é recusada.',
    seed: 'default',
    config: { walletConnect: { outcome: 'reject' } },
  },
]

export const SCENARIOS = Object.fromEntries(list.map((s) => [s.id, s])) as Record<
  ScenarioId,
  Scenario
>
export const SCENARIO_LIST: readonly Scenario[] = list
