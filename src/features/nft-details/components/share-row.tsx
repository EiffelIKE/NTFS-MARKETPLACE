import { useLocation } from '@tanstack/react-router'

import { MailIcon, ShareLinkedinIcon, ShareTwitterIcon } from '@/components/icons'
import { cn } from '@/lib/utils'

const linkClass =
  'relative flex size-6 items-center justify-center text-foreground hover:text-text-accent [&_svg]:size-4.5'

/** Share targets (DET-09): real share URLs for this page, desktop only as in Figma. */
export function ShareRow({ name, className }: { name: string; className?: string }) {
  const href = useLocation({ select: (location) => location.href })
  const url = encodeURIComponent(`${window.location.origin}${href}`)
  const subject = encodeURIComponent(`${name} na KURIO`)
  const text = encodeURIComponent(name)

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <p className="text-body-md font-bold text-foreground">Compartilhar este NFT:</p>
      <a
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${url}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Compartilhar no LinkedIn (abre em nova aba)"
        className={linkClass}
      >
        <ShareLinkedinIcon />
      </a>
      <a
        href={`mailto:?subject=${subject}&body=${url}`}
        aria-label="Compartilhar por e-mail"
        className={linkClass}
      >
        <MailIcon />
      </a>
      <a
        href={`https://twitter.com/intent/tweet?url=${url}&text=${text}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Compartilhar no Twitter (abre em nova aba)"
        className={linkClass}
      >
        <ShareTwitterIcon />
      </a>
    </div>
  )
}
