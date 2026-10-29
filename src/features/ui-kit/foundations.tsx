import type * as React from 'react'

import * as Icons from '@/components/icons'

import { Section } from './section'

// Swatches read the tokens through `var()`. Ratios are on ink / surface-card / surface-dark and
// mirror the design §3 table that `src/styles/contrast.test.ts` asserts.
const colors: readonly (readonly [token: string, note: string])[] = [
  ['ink', 'fundo'],
  ['surface-card', 'superfície'],
  ['surface-raised', 'superfície'],
  ['surface-dark', 'superfície'],
  ['border', 'decorativa'],
  ['border-soft', 'decorativa'],
  ['primary', '6.85 · 6.24 · 5.33'],
  ['secondary', '6.72 · 6.12 · 5.22'],
  ['foreground', '17.10 · 15.57 · 13.29'],
  ['text-primary', 'texto'],
  ['text-secondary', '9.53 · 8.68 · 7.41'],
  ['text-accent', '8.47 · 7.72 · 6.59'],
  ['error', '7.54 · 6.87 · 5.87'],
  ['error-surface', 'error 6.16'],
  ['success', '10.35 · 9.43 · 8.05'],
  ['success-surface', 'superfície'],
  ['warning', '11.32 · 10.31 · 8.80'],
  ['disabled', 'desabilitado'],
  ['skeleton', 'esqueleto'],
  ['skeleton-highlight', 'esqueleto'],
  ['scrim', 'sobreposição'],
]

const typeSteps = [
  ['text-display', 'Display 43'],
  ['text-heading', 'Heading 24'],
  ['text-title', 'Title 18'],
  ['text-body-lg', 'Body large 16'],
  ['text-body-md', 'Body medium 15'],
  ['text-body', 'Body 14'],
  ['text-caption', 'Caption 13'],
  ['text-caption-sm', 'Caption small 12'],
  ['text-tiny', 'Tiny 10'],
] as const

export function ColorsSection() {
  return (
    <Section id="cores" title="Cores" className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {colors.map(([name, note]) => (
        <figure key={name} className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="size-10 shrink-0 rounded-sm border border-border-soft"
            style={{ background: `var(--color-${name})` }}
          />
          <figcaption className="text-caption-sm text-text-secondary">
            <span className="block text-foreground">{name}</span>
            {note}
          </figcaption>
        </figure>
      ))}
    </Section>
  )
}

export function TypeSection() {
  return (
    <Section id="tipografia" title="Tipografia" className="flex-col items-start gap-2">
      {typeSteps.map(([className, label]) => (
        <p key={className} className={`${className} text-foreground`}>
          {label} — Seja dono da cultura digital
        </p>
      ))}
      <p className="text-body font-bold tracking-brand text-foreground">KURIO (tracking-brand)</p>
      {/* Fixed sample for the fallback-metrics E2E (DS-10): three explicit lines, no wrapping. */}
      <p data-testid="font-metrics-sample" className="text-body whitespace-nowrap text-foreground">
        Seja dono da cultura digital
        <br />
        Coleções raras · 0,42 ETH
        <br />
        Ágil, íntegro, ÇÃÕ gjpqy
      </p>
    </Section>
  )
}

export function IconsSection() {
  // Every runtime export of the registry is an icon component that takes SVG props.
  const entries = Object.entries(Icons) as [string, React.FC<React.SVGProps<SVGSVGElement>>][]
  return (
    <Section id="icones" title="Ícones" className="grid grid-cols-3 gap-3 sm:grid-cols-6">
      {entries.map(([name, Icon]) => (
        <figure key={name} className="flex flex-col items-center gap-1 text-center">
          <span className="flex gap-2">
            <Icon className="size-6 text-text-accent" />
            <Icon className="size-6 text-foreground" />
          </span>
          <figcaption className="text-tiny break-all text-text-secondary">{name}</figcaption>
        </figure>
      ))}
    </Section>
  )
}
