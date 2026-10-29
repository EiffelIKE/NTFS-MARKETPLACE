import { WalletIcon } from '@/components/icons'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { WALLET_PROVIDER_LABELS, WalletProvider } from '@/contracts'
import { cn } from '@/lib/utils'

import { useCheckoutContext } from './checkout-context'

/** The order Figma lists the providers in. */
const PROVIDERS: readonly WalletProvider[] = ['walletconnect', 'metamask', 'coinbase']

const AVATAR_LETTER: Record<WalletProvider, string | null> = {
  walletconnect: 'W',
  metamask: 'M',
  coinbase: null,
}

/**
 * "Carteira e rede" (CHK-13): WalletConnect, MetaMask and Coinbase Wallet as one radio group bound
 * to the form's `provider`, which "Tipo de carteira" in the form also sets (open question 1). On
 * desktop the rows are 45 tall bordered cards, with the "compatible wallets" caption above them as
 * plain text (open question 5); on phones they carry the 40 circle avatars of Figma.
 */
export function ProviderPicker({
  variant,
  className,
}: {
  variant: 'list' | 'rows'
  className?: string
}) {
  const { form } = useCheckoutContext()
  const rows = variant === 'rows'

  return (
    <form.AppField name="provider">
      {(field) => (
        <RadioGroup
          aria-labelledby="provider-title"
          value={field.state.value}
          onValueChange={(value) => {
            const provider = WalletProvider.safeParse(value)
            if (provider.success) field.handleChange(provider.data)
          }}
          className={cn(rows ? 'gap-3' : 'gap-4', className)}
        >
          {PROVIDERS.map((provider) => {
            const id = `provider-${provider}`
            const selected = field.state.value === provider
            return (
              <div
                key={provider}
                className={cn(
                  'flex items-center gap-3 px-4',
                  rows
                    ? 'rounded-artwork-mobile bg-surface-card py-2.5'
                    : 'h-11.25 rounded-sm border bg-ink',
                  !rows && (selected ? 'border-foreground' : 'border-border'),
                )}
              >
                {rows && (
                  <span
                    aria-hidden="true"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-dark text-body-lg font-bold text-text-accent"
                  >
                    {AVATAR_LETTER[provider] ?? <WalletIcon className="size-5" />}
                  </span>
                )}
                <Label
                  htmlFor={id}
                  className="flex-1 cursor-pointer text-body-lg font-normal text-foreground"
                >
                  {WALLET_PROVIDER_LABELS[provider]}
                </Label>
                <RadioGroupItem id={id} value={provider} className={cn(!rows && 'order-first')} />
              </div>
            )
          })}
        </RadioGroup>
      )}
    </form.AppField>
  )
}
