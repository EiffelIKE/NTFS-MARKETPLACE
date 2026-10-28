import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useRealtimeStatus, realtime, type RealtimeStatus } from '@/lib/realtime'

import { Section } from '../ui-kit/section'

const STATUS_LABEL: Record<RealtimeStatus, string> = {
  connecting: 'conectando',
  connected: 'conectado',
  reconnecting: 'reconectando',
  disconnected: 'desconectado',
}

/** Test-only session plumbing: spec 04 is the real caller of `realtime.setSession`. */
export function ConnectionSection({ onConnect }: { onConnect: (token: string | null) => void }) {
  const status = useRealtimeStatus()
  const queryClient = useQueryClient()
  const [token, setToken] = useState('')

  const connect = (next: string | null) => {
    // A different identity must not see the previous one's cached orders.
    queryClient.removeQueries({ queryKey: ['orders'] })
    realtime.setSession(next ? { key: `dev:${next}`, token: next } : { key: 'guest', token: null })
    onConnect(next)
  }

  return (
    <Section id="conexao" title="Conexão" className="items-end">
      <p role="status" aria-label="Conexão" className="w-full text-body-lg text-foreground">
        Status: {STATUS_LABEL[status]}
      </p>
      <Field className="w-72">
        <FieldLabel>Token de teste</FieldLabel>
        <Input
          value={token}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => {
            setToken(event.target.value)
          }}
        />
      </Field>
      <Button
        disabled={token.trim() === ''}
        onClick={() => {
          connect(token.trim())
        }}
      >
        Conectar com token
      </Button>
      <Button
        variant="outline"
        onClick={() => {
          connect(null)
        }}
      >
        Conectar como visitante
      </Button>
    </Section>
  )
}
