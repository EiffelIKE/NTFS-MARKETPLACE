import { Link } from '@tanstack/react-router'

import { ArrowRightIcon } from '@/components/icons'
import { NftImage } from '@/components/nft-image'
import { Button } from '@/components/ui/button'

import { PROMOS } from '../content/home-copy'

/** Two static promo cards (CAT-22), desktop only; "Explorar" opens a catalog state. */
export function PromoCards() {
  return (
    <section aria-label="Promoções" className="hidden gap-7 lg:grid lg:grid-cols-2">
      {PROMOS.map((promo) => (
        <article
          key={promo.id}
          className="relative flex h-62.5 overflow-hidden rounded-md bg-surface-card"
        >
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -bottom-32 -left-24 size-64 rounded-full bg-foreground/5" />
            <div className="absolute -bottom-40 left-12 size-64 rounded-full bg-foreground/5" />
          </div>
          <NftImage
            image={promo.image}
            slot="promo"
            className="relative h-62.5 w-72 shrink-0 rounded-artwork-lg object-cover"
          />
          <div className="relative flex min-w-0 flex-1 flex-col items-end pt-9 pr-7.5 pl-1 text-right">
            <h2 className="text-title text-foreground">{promo.title}</h2>
            <p className="mt-2 max-w-66 text-body leading-6 text-text-secondary">{promo.text}</p>
            <Button asChild className="mt-auto mb-11.5 w-35 gap-1 px-0 text-body font-medium">
              <Link
                to="/"
                search={promo.search}
                hash="mercado"
                aria-label={`Explorar: ${promo.title}`}
              >
                Explorar
                <ArrowRightIcon className="size-4.5" />
              </Link>
            </Button>
          </div>
        </article>
      ))}
    </section>
  )
}
