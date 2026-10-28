import { useEffect, useId, useReducer, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

import type { LatencyConfig } from '../config'
import { createControl } from '../control'
import { SCENARIO_LIST, type ScenarioId } from '../scenarios'
import type { MockRuntime } from '../runtime'

type LatencyChoice = 'default' | 'none' | 'fast' | 'slow' | 'variable'

const LATENCY: Record<Exclude<LatencyChoice, 'default'>, LatencyConfig> = {
  none: { kind: 'none' },
  fast: { kind: 'fixed', ms: 500 },
  slow: { kind: 'fixed', ms: 2000 },
  variable: { kind: 'range', minMs: 150, maxMs: 2500 },
}

const LATENCY_LABELS: Record<LatencyChoice, string> = {
  default: 'Padrão do cenário',
  none: 'Sem atraso',
  fast: '500 ms',
  slow: '2 s',
  variable: 'Variável',
}

function latencyChoiceOf(runtime: MockRuntime): LatencyChoice {
  const override = runtime.config.overrides().latency
  if (!override) return 'default'
  const found = (Object.entries(LATENCY) as [keyof typeof LATENCY, LatencyConfig][]).find(
    ([, value]) => JSON.stringify(value) === JSON.stringify(override),
  )
  return found?.[0] ?? 'default'
}

interface MockPanelProps {
  runtime: MockRuntime
  initialOpen: boolean
  registerOpen: (open: () => void) => void
  onFirstOpen: () => void
}

/** The mock panel (spec 02 §11): scenario, network, payment and data, in pt-BR. */
export function MockPanel({ runtime, initialOpen, registerOpen, onFirstOpen }: MockPanelProps) {
  const [open, setOpen] = useState(initialOpen)
  // The launcher appears with the first open and then stays for the tab session.
  const [launcher, setLauncher] = useState(initialOpen || sessionFlag())
  const [scenario, setScenario] = useState<ScenarioId>(runtime.config.scenarioId())
  const [status, setStatus] = useState('')
  const [, refresh] = useReducer((n: number) => n + 1, 0)
  const ids = useId()
  const control = createControl(runtime)

  const changeOpen = (next: boolean) => {
    setOpen(next)
    if (next) {
      setLauncher(true)
      onFirstOpen()
    }
  }

  useEffect(() => {
    registerOpen(() => {
      changeOpen(true)
    })
    // `changeOpen` only closes over stable setters and the `onFirstOpen` prop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerOpen])

  useEffect(() => {
    if (initialOpen) onFirstOpen()
  }, [initialOpen, onFirstOpen])

  const config = runtime.config.effective()
  const offlineRule = config.rules.find(
    (rule) => rule.op === '*' && rule.effect.kind === 'network-error' && rule.times === 'always',
  )
  const pending = runtime.store.read((state) =>
    Object.values(state.orders).filter((order) => order.status === 'pending'),
  )

  const say = (message: string) => {
    setStatus(message)
    refresh()
  }

  const setLatency = (choice: LatencyChoice) => {
    if (choice === 'default') runtime.config.clearLatencyOverride()
    else runtime.config.configure({ latency: LATENCY[choice] })
    say(`Latência: ${LATENCY_LABELS[choice]}.`)
  }

  const setOffline = (checked: boolean) => {
    if (checked && !offlineRule) {
      control.addRule({ op: '*', effect: { kind: 'network-error' }, times: 'always' })
    } else if (!checked && offlineRule) {
      runtime.config.removeRule(offlineRule.id)
    }
    say(checked ? 'Sem conexão ativado.' : 'Sem conexão desativado.')
  }

  const settleAll = (outcome: 'confirmed' | 'declined') => {
    for (const order of pending) control.settleOrder(order.id, outcome)
    say(outcome === 'confirmed' ? 'Pedidos pendentes confirmados.' : 'Pedidos pendentes recusados.')
  }

  const reload = () => {
    window.location.reload()
  }

  return (
    <>
      <div role="status" aria-live="polite" className="sr-only">
        {status}
      </div>
      <Sheet open={open} onOpenChange={changeOpen}>
        {launcher && (
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="fixed bottom-4 left-4 z-40 bg-surface-card"
            >
              Simulação
            </Button>
          </SheetTrigger>
        )}
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Simulação da API</SheetTitle>
            <SheetDescription>
              Escolha um cenário ou ajuste a rede para testar carregamento, erros e recuperação.
            </SheetDescription>
          </SheetHeader>

          <section aria-labelledby={`${ids}-scenario`} className="flex flex-col gap-3">
            <h3 id={`${ids}-scenario`} className="text-body-lg font-bold">
              Cenário
            </h3>
            <RadioGroup
              value={scenario}
              onValueChange={(value) => {
                setScenario(value as ScenarioId)
              }}
              aria-labelledby={`${ids}-scenario`}
            >
              {SCENARIO_LIST.map(({ id, label, description }) => (
                <div key={id} className="flex items-start gap-3">
                  <RadioGroupItem value={id} id={`${ids}-sc-${id}`} className="mt-0.5" />
                  <Label
                    htmlFor={`${ids}-sc-${id}`}
                    className="flex flex-col items-start gap-0.5 font-normal"
                  >
                    <span className="font-bold">{label}</span>
                    <span className="text-caption text-text-secondary">{description}</span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
            <Button
              onClick={() => {
                runtime.useScenario(scenario)
                reload()
              }}
            >
              Aplicar e recarregar
            </Button>
          </section>

          <section aria-labelledby={`${ids}-network`} className="flex flex-col gap-3">
            <h3 id={`${ids}-network`} className="text-body-lg font-bold">
              Rede
            </h3>
            <RadioGroup
              value={latencyChoiceOf(runtime)}
              onValueChange={(value) => {
                setLatency(value as LatencyChoice)
              }}
              aria-labelledby={`${ids}-network`}
            >
              {(Object.keys(LATENCY_LABELS) as LatencyChoice[]).map((choice) => (
                <div key={choice} className="flex items-center gap-3">
                  <RadioGroupItem value={choice} id={`${ids}-lat-${choice}`} />
                  <Label htmlFor={`${ids}-lat-${choice}`} className="font-normal">
                    {LATENCY_LABELS[choice]}
                  </Label>
                </div>
              ))}
            </RadioGroup>
            <div className="flex items-center gap-3">
              <Checkbox
                id={`${ids}-offline`}
                checked={Boolean(offlineRule)}
                onCheckedChange={(checked) => {
                  setOffline(checked === true)
                }}
              />
              <Label htmlFor={`${ids}-offline`} className="font-normal">
                Sem conexão
              </Label>
            </div>
          </section>

          <section aria-labelledby={`${ids}-payment`} className="flex flex-col gap-3">
            <h3 id={`${ids}-payment`} className="text-body-lg font-bold">
              Pagamento
            </h3>
            <RadioGroup
              value={config.payment.outcome}
              onValueChange={(value) => {
                runtime.config.configure({
                  payment: { outcome: value as 'confirm' | 'decline' | 'manual' },
                })
                runtime.settlement.arm()
                say('Resultado do pagamento atualizado.')
              }}
              aria-labelledby={`${ids}-payment`}
            >
              {(
                [
                  ['confirm', 'Confirmar automaticamente'],
                  ['decline', 'Recusar automaticamente'],
                  ['manual', 'Liquidar manualmente'],
                ] as const
              ).map(([value, label]) => (
                <div key={value} className="flex items-center gap-3">
                  <RadioGroupItem value={value} id={`${ids}-pay-${value}`} />
                  <Label htmlFor={`${ids}-pay-${value}`} className="font-normal">
                    {label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
            {config.payment.outcome === 'manual' && (
              <div className="flex flex-col gap-2">
                <p className="text-caption text-text-secondary">
                  Liquidar pedidos pendentes: {String(pending.length)}
                </p>
                <Button
                  variant="outline"
                  disabled={pending.length === 0}
                  onClick={() => {
                    settleAll('confirmed')
                  }}
                >
                  Confirmar pedidos pendentes
                </Button>
                <Button
                  variant="outline"
                  disabled={pending.length === 0}
                  onClick={() => {
                    settleAll('declined')
                  }}
                >
                  Recusar pedidos pendentes
                </Button>
              </div>
            )}
          </section>

          <section aria-labelledby={`${ids}-data`} className="flex flex-col gap-3">
            <h3 id={`${ids}-data`} className="text-body-lg font-bold">
              Dados
            </h3>
            <Button
              variant="outline"
              onClick={() => {
                runtime.reset()
                reload()
              }}
            >
              Restaurar dados do cenário
            </Button>
          </section>

          <p className="mt-auto text-caption text-text-secondary">
            Cenário ativo: <code>{runtime.config.scenarioId()}</code>. Veja a seção “Simulação da
            API” do README.
          </p>
        </SheetContent>
      </Sheet>
    </>
  )
}

function sessionFlag(): boolean {
  try {
    return sessionStorage.getItem('kurio.mock.panel') === '1'
  } catch {
    return false
  }
}
