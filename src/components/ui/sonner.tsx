import type * as React from 'react'
import { Toaster as Sonner, type ToasterProps } from 'sonner'

import {
  AlertCircleIcon,
  CheckCircleIcon,
  CloseIcon,
  DangerTriangleIcon,
  SpinnerIcon,
} from '@/components/icons'
import { useMediaQuery } from '@/hooks/use-media-query'

// Toasts (DS-19): type icon + text, never color alone. Bottom-right from `lg`; top-center below it
// (spec 11 amendment of spec 01 design §6): the bottom of a phone screen belongs to the tab bar and
// to the fixed action bars (details, cart, checkout, receipt), and a toast there covered the
// primary action of the screen ("Salvar" in the profile) for as long as it lasted.
function Toaster(props: ToasterProps) {
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const mobileOffset = { top: 'calc(12px + env(safe-area-inset-top))' }

  return (
    <Sonner
      theme="dark"
      position={isDesktop ? 'bottom-right' : 'top-center'}
      offset={isDesktop ? 24 : mobileOffset}
      mobileOffset={mobileOffset}
      closeButton
      containerAriaLabel="Notificações"
      className="toaster"
      icons={{
        success: <CheckCircleIcon className="size-5 text-success" />,
        info: <AlertCircleIcon className="size-5 rotate-180 text-text-accent" />,
        warning: <DangerTriangleIcon className="size-5 text-warning" />,
        error: <AlertCircleIcon className="size-5 text-error" />,
        loading: <SpinnerIcon className="size-5 text-text-accent" />,
        close: <CloseIcon className="size-3.5" />,
      }}
      style={
        {
          '--normal-bg': 'var(--color-surface-card)',
          '--normal-text': 'var(--color-foreground)',
          '--normal-border': 'var(--color-border)',
          '--border-radius': 'var(--radius-md)',
        } as React.CSSProperties
      }
      toastOptions={{
        closeButtonAriaLabel: 'Fechar notificação',
        classNames: {
          toast: 'font-sans! text-body! gap-3!',
          title: 'font-medium!',
          description: 'text-text-secondary! whitespace-pre-line',
          actionButton: 'bg-primary! text-ink! font-bold! rounded-sm!',
          closeButton: 'bg-surface-dark! text-foreground! border-border!',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
