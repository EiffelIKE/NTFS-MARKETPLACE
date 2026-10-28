import { useRealtimeEventLog, type EventOutcome } from '@/lib/realtime'

import { Section } from '../ui-kit/section'

const OUTCOME: Record<EventOutcome, string> = {
  applied: 'aplicado',
  duplicate: 'duplicado',
  stale: 'antigo',
  invalid: 'inválido',
}

/** What the manager did with the last 50 events, oldest first. */
export function EventLogSection() {
  const log = useRealtimeEventLog()
  return (
    <Section id="eventos" title="Eventos" className="flex-col items-stretch">
      {log.length === 0 ? (
        <p className="text-body text-text-secondary">Nenhum evento recebido.</p>
      ) : (
        <div className="overflow-x-auto">
          <table aria-label="Eventos recebidos" className="w-full text-left text-body">
            <thead>
              <tr className="text-text-secondary">
                <th scope="col" className="pr-4 font-normal">
                  Evento
                </th>
                <th scope="col" className="pr-4 font-normal">
                  Recurso
                </th>
                <th scope="col" className="pr-4 font-normal">
                  Versão
                </th>
                <th scope="col" className="font-normal">
                  Resultado
                </th>
              </tr>
            </thead>
            <tbody>
              {log.map((entry) => (
                <tr key={entry.seq}>
                  <td className="pr-4">{entry.type}</td>
                  <td className="pr-4">{entry.resource || '—'}</td>
                  <td className="pr-4">{entry.version}</td>
                  <td>{OUTCOME[entry.outcome]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  )
}
