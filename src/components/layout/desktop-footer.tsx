import { Link } from '@tanstack/react-router'
import type * as React from 'react'

import {
  FacebookIcon,
  InstagramIcon,
  LinkedinIcon,
  TwitterIcon,
  YoutubeIcon,
} from '@/components/icons'
import { cn } from '@/lib/utils'

import { NewsletterForm } from './newsletter-form'
import { PageContainer } from './page-container'
import { Unavailable } from './unavailable'

// Figma "Footer" (DS-26): features + newsletter, brand band, link columns, copyright.

const features = [
  {
    letter: 'W',
    title: 'Segurança da carteira',
    text: 'Proteja sua carteira e colecione arte digital verificada com confiança.',
  },
  {
    letter: 'C',
    title: 'Criadores em destaque',
    text: 'Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.',
  },
  {
    letter: 'D',
    title: 'Alertas de lançamentos',
    text: 'Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.',
  },
]

type FooterLink =
  { label: string; to: '/profile' } | { label: string; category: string } | { label: string }

const columns: { title: string; links: FooterLink[] }[] = [
  {
    title: 'Meu perfil',
    links: [
      { label: 'Meu perfil', to: '/profile' },
      { label: 'Minha coleção' },
      { label: 'Atividade' },
      { label: 'Estúdio do criador' },
      // Spec 05 points this at the favorites filter (`/?favorites=1`), like the tab bar heart.
      { label: 'Lista de interesse' },
    ],
  },
  {
    title: 'Central de ajuda',
    links: [
      { label: 'Central de ajuda' },
      { label: 'Como comprar NFTs' },
      { label: 'Carteira e segurança' },
      { label: 'Política do mercado' },
      { label: 'Denunciar item' },
    ],
  },
  {
    title: 'Coleções',
    links: [
      { label: 'Arte digital', category: 'arte-digital' },
      { label: 'Fotografia', category: 'fotografia' },
      { label: 'Música', category: 'musica' },
      { label: 'Arte 3D', category: 'arte-3d' },
      { label: 'Utilidade', category: 'utilidade' },
    ],
  },
]

const socials = [
  { label: 'Facebook', href: 'https://facebook.com', Icon: FacebookIcon },
  { label: 'Instagram', href: 'https://instagram.com', Icon: InstagramIcon },
  { label: 'Twitter', href: 'https://twitter.com', Icon: TwitterIcon },
  { label: 'LinkedIn', href: 'https://linkedin.com', Icon: LinkedinIcon },
  { label: 'YouTube', href: 'https://youtube.com', Icon: YoutubeIcon },
]

const linkClass = 'text-body leading-7.5 text-foreground hover:text-text-accent hover:underline'

// Shared by the brand band and the links panel, so their columns line up as in Figma.
const bandGrid = 'grid grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,228px)] gap-x-8 px-8'

function FooterLinkItem({ link }: { link: FooterLink }) {
  if ('to' in link) {
    return (
      <Link to={link.to} className={linkClass}>
        {link.label}
      </Link>
    )
  }
  if ('category' in link) {
    return (
      <Link to="/" search={{ categories: link.category }} hash="mercado" className={linkClass}>
        {link.label}
      </Link>
    )
  }
  return <Unavailable className={cn(linkClass, 'hover:no-underline')}>{link.label}</Unavailable>
}

export function DesktopFooter({ className, ...props }: React.ComponentProps<'footer'>) {
  return (
    <footer className={cn('mt-section pb-6', className)} {...props}>
      <PageContainer>
        <section
          aria-label="Destaques e newsletter"
          className="grid grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,341px)] bg-surface-card p-8"
        >
          {features.map((feature) => (
            <div
              key={feature.letter}
              className="flex flex-col gap-3 border-r border-primary px-4 first:pl-4"
            >
              <span
                aria-hidden="true"
                className="flex size-18.5 items-center justify-center rounded-full bg-primary text-heading text-ink"
              >
                {feature.letter}
              </span>
              {/* Figma sets these at 17 px; at 18 they need the column's right padding from 1280 up. */}
              <h2 className="text-title text-foreground xl:whitespace-nowrap">{feature.title}</h2>
              <p className="max-w-53.5 text-body text-text-secondary">{feature.text}</p>
            </div>
          ))}
          <div className="flex flex-col gap-4 pl-4">
            <h2 className="text-title leading-4 text-foreground">
              Antecipe-se ao próximo lançamento
            </h2>
            <NewsletterForm />
          </div>
        </section>

        <div className={cn(bandGrid, 'items-center bg-surface-dark py-5.5')}>
          <p className="text-body font-bold tracking-brand text-foreground">KURIO</p>
          <p className="max-w-56 text-body text-foreground">
            Feito para colecionadores, criadores e cultura
          </p>
          <a
            href="mailto:contato@kurio.example"
            className="w-fit truncate text-body text-foreground hover:text-text-accent"
          >
            contato@kurio.example
          </a>
          <a
            href="tel:+551140028922"
            className="w-fit text-body text-foreground hover:text-text-accent"
          >
            +55 11 4002 8922
          </a>
        </div>

        <div className={cn(bandGrid, 'bg-surface-card py-8')}>
          {columns.map((column) => (
            <nav key={column.title} aria-labelledby={`footer-${column.title}`}>
              <h2 id={`footer-${column.title}`} className="text-title leading-7.5 text-foreground">
                {column.title}
              </h2>
              <ul>
                {column.links.map((link) => (
                  <li key={link.label}>
                    <FooterLinkItem link={link} />
                  </li>
                ))}
              </ul>
            </nav>
          ))}
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <h2 className="text-title leading-7.5 whitespace-nowrap text-foreground">
                Redes sociais
              </h2>
              <ul className="flex flex-wrap gap-2.5">
                {socials.map(({ label, href, Icon }) => (
                  <li key={label}>
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${label} (abre em nova aba)`}
                      className="flex size-7.5 items-center justify-center rounded-xs border border-primary text-primary hover:bg-surface-dark"
                    >
                      <Icon className="size-4" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col gap-2">
              <h2 className="text-title leading-7.5 whitespace-nowrap text-foreground">
                Carteiras compatíveis
              </h2>
              <p className="w-fit rounded-sm border border-border-soft bg-surface-dark px-2 py-1 text-tiny font-bold whitespace-nowrap text-text-accent">
                METAMASK • WALLETCONNECT • COINBASE
              </p>
            </div>
          </div>
        </div>

        <p className="mt-1.5 text-center text-body leading-7.5 text-foreground">
          © 2026 Kurio. Propriedade digital para todos.
        </p>
      </PageContainer>
    </footer>
  )
}
