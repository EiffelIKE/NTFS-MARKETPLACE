import * as React from 'react'

import { subscribe, type Politeness } from './announcer-store'

/** Two visually hidden live regions, mounted once in the root (DS-19). */
export function Announcer() {
  const [messages, setMessages] = React.useState<Record<Politeness, string>>({
    polite: '',
    assertive: '',
  })

  React.useEffect(
    () =>
      subscribe((politeness, message) => {
        setMessages((current) => ({ ...current, [politeness]: message }))
      }),
    [],
  )

  return (
    <div className="sr-only">
      <div role="status" aria-live="polite" aria-atomic="true" data-testid="announcer-polite">
        {messages.polite}
      </div>
      <div role="alert" aria-live="assertive" aria-atomic="true" data-testid="announcer-assertive">
        {messages.assertive}
      </div>
    </div>
  )
}
