import { useSession } from '@/features/auth/model/use-session'
import { useRealtimeStatus, type RealtimeStatus } from '@/lib/realtime'

import { Section } from '../ui-kit/section'

const STATUS_LABEL: Record<RealtimeStatus, string> = {
  connecting: 'conectando',
  connected: 'conectado',
  reconnecting: 'reconectando',
  disconnected: 'desconectado',
}

/** The socket's state and whose it is. The identity comes from the real session (spec 04). */
export function ConnectionSection() {
  const status = useRealtimeStatus()
  const session = useSession()

  return (
    <Section id="conexao" title="Conexão" className="flex-col items-start">
      <p role="status" aria-label="Conexão" className="w-full text-body-lg text-foreground">
        Status: {STATUS_LABEL[status]}
      </p>
      <p className="text-body text-text-secondary">
        {session.status === 'authenticated'
          ? `Sessão: ${session.user.displayName}`
          : 'Sessão: visitante'}
      </p>
    </Section>
  )
}
