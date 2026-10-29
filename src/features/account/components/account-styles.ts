// Shared look of the account controls: Figma fields sit on `ink` with a 1 px `border`; below `lg`
// they grow to 50 tall with the mobile radius, as the auth fields do (spec 08 design §8).
export const accountInput =
  'bg-ink border-border focus-visible:border-primary max-lg:h-12.5 max-lg:rounded-input-mobile'

export const accountGroup =
  'bg-ink border-border focus-within:border-primary max-lg:h-12.5 max-lg:rounded-input-mobile'

export const accountSelect =
  'bg-ink border-border data-[state=open]:border-primary max-lg:h-12.5 max-lg:rounded-input-mobile'

/** "Salvar" and "Salvar carteira": 131 × 40 on desktop, a full-width 60 pill below `lg`. */
export const accountSubmit =
  'lg:self-start lg:min-w-32.75 max-lg:h-15 max-lg:w-full max-lg:rounded-input-mobile max-lg:bg-primary-cta max-lg:text-title'

/** The two-column field grid of both screens (one column on phones). */
export const accountGrid = 'grid gap-x-7 gap-y-5 md:grid-cols-2 lg:gap-y-9'
