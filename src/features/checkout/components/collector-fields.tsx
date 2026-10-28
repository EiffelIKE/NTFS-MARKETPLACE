import { AlertCircleIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { NETWORK_LABELS, networkFamily, type NetworkId } from '@/contracts'
import {
  accountGroup,
  accountInput,
  accountSelect,
} from '@/features/account/components/account-styles'
import { PROVIDER_OPTIONS } from '@/features/account/model/wallet-form'
import { cn } from '@/lib/utils'

import { useCheckoutContext } from './checkout-context'

const NETWORK_ORDER: readonly NetworkId[] = ['ethereum', 'polygon', 'solana']

/**
 * "Rede" offers the networks the chosen wallet's address family can pay on (CHK-11). Names come
 * from `networks.list`; until it answers, the contract's own labels stand in so the select never
 * shows a raw id, and when it fails the select is disabled with a retry (CHK-04).
 */
function useNetworkOptions() {
  const { networks, wallet } = useCheckoutContext()
  const fromApi = networks.data?.items.filter((network) => network.walletFamily === wallet.family)
  const options = fromApi
    ? fromApi.map((network) => ({ value: network.id, label: network.name }))
    : NETWORK_ORDER.filter((id) => networkFamily(id) === wallet.family).map((id) => ({
        value: id,
        label: NETWORK_LABELS[id],
      }))
  return { options, failed: networks.isError, retry: () => void networks.refetch() }
}

/**
 * The "Perfil do colecionador" fields in the order of the Figma grid (CHK-05): two columns from
 * `md`, one on phones. The wallet address comes from the chosen wallet and is read-only (CHK-10);
 * "Tipo de carteira" is the same value as the provider list on the right (CHK-13).
 */
export function CollectorFields({ className }: { className?: string }) {
  const { form } = useCheckoutContext()
  const network = useNetworkOptions()

  return (
    <div className={cn('grid gap-x-6 gap-y-5 md:grid-cols-2', className)}>
      <form.AppField name="displayName">
        {(field) => (
          <field.TextField
            label="Nome de exibição"
            required
            autoComplete="nickname"
            className={accountInput}
          />
        )}
      </form.AppField>

      <form.AppField name="username">
        {(field) => (
          <field.TextField
            label="Nome de usuário"
            required
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            className={accountInput}
          />
        )}
      </form.AppField>

      <div className="flex flex-col gap-2">
        <form.AppField name="network">
          {(field) => (
            <field.SelectField
              label="Rede"
              placeholder="Selecione uma rede"
              required
              disabled={network.failed}
              options={network.options}
              className={accountSelect}
            />
          )}
        </form.AppField>
        {network.failed && (
          <p className="flex items-center gap-2 text-caption-sm text-error">
            <AlertCircleIcon className="size-4 shrink-0" />
            Não foi possível carregar as redes.
            <Button
              type="button"
              variant="link"
              className="text-caption-sm"
              onClick={network.retry}
            >
              Tentar novamente
            </Button>
          </p>
        )}
      </div>

      <form.AppField name="profileName">
        {(field) => <field.TextField label="Nome do perfil" required className={accountInput} />}
      </form.AppField>

      <form.AppField name="walletAddress">
        {(field) => (
          <field.TextField
            label="Endereço da carteira"
            required
            readOnly
            placeholder="Endereço 0x da carteira"
            spellCheck={false}
            className={accountInput}
          />
        )}
      </form.AppField>

      <form.AppField name="alternateWallet">
        {(field) => (
          <field.TextField
            label="ENS ou carteira secundária (opcional)"
            hideLabel
            placeholder="ENS ou carteira secundária (opcional)"
            autoCapitalize="none"
            spellCheck={false}
            className={accountInput}
            fieldClassName="md:mt-7.5"
          />
        )}
      </form.AppField>

      <form.AppField name="provider">
        {(field) => (
          <field.SelectField
            label="Tipo de carteira"
            placeholder="Selecione uma carteira"
            required
            options={PROVIDER_OPTIONS}
            className={accountSelect}
          />
        )}
      </form.AppField>

      <form.AppField name="referralCode">
        {(field) => (
          <field.TextField
            label="Código de indicação"
            required
            autoCapitalize="characters"
            spellCheck={false}
            format={(value) => value.toUpperCase()}
            className={accountInput}
          />
        )}
      </form.AppField>

      <form.AppField name="email">
        {(field) => (
          <field.TextField
            label="E-mail"
            required
            type="email"
            inputMode="email"
            autoComplete="email"
            className={accountInput}
          />
        )}
      </form.AppField>

      <form.AppField name="ensName">
        {(field) => <field.EnsField required className={accountGroup} />}
      </form.AppField>
    </div>
  )
}

/** "Observação do colecionador (opcional)" (CHK-05): up to 500 characters. */
export function NoteField({ className }: { className?: string }) {
  const { form } = useCheckoutContext()
  return (
    <form.AppField name="note">
      {(field) => (
        <field.TextareaField
          label="Observação do colecionador (opcional)"
          limit={500}
          rows={5}
          className={cn(accountInput, 'min-h-37.5 py-2 max-lg:h-auto', className)}
        />
      )}
    </form.AppField>
  )
}
