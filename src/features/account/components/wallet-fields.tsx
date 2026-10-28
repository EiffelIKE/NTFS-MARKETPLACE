import type { WalletFormHook } from './use-wallet-form'
import { accountGrid, accountGroup, accountInput, accountSelect } from './account-styles'
import { addressPlaceholder, NETWORK_OPTIONS, PROVIDER_OPTIONS } from '../model/wallet-form'

/** The Figma wallet grid (ACC-17): the same fields in both slots. */
export function WalletFields({ form }: { form: WalletFormHook['form'] }) {
  return (
    <div className={accountGrid}>
      <form.AppField name="displayName">
        {(field) => (
          <field.TextField
            label="Nome de exibição"
            required
            autoComplete="name"
            className={accountInput}
          />
        )}
      </form.AppField>

      <form.AppField name="nickname">
        {(field) => (
          <field.TextField label="Apelido da carteira" required className={accountInput} />
        )}
      </form.AppField>

      <form.AppField name="network">
        {(field) => (
          <field.SelectField
            label="Rede"
            placeholder="Selecione uma rede"
            options={NETWORK_OPTIONS}
            required
            className={accountSelect}
            // The address belongs to a network family: re-check the one already typed (ACC-17).
            onValueChange={() => {
              if (form.getFieldValue('address')) void form.validateField('address', 'blur')
            }}
          />
        )}
      </form.AppField>

      <form.AppField name="profileName">
        {(field) => <field.TextField label="Nome do perfil" required className={accountInput} />}
      </form.AppField>

      <form.AppField name="address">
        {(field) => (
          <form.Subscribe selector={(state) => state.values.network}>
            {(network) => (
              <field.TextField
                label="Endereço da carteira"
                required
                autoCapitalize="none"
                autoComplete="off"
                spellCheck={false}
                placeholder={addressPlaceholder(network)}
                className={accountInput}
              />
            )}
          </form.Subscribe>
        )}
      </form.AppField>

      <form.AppField name="alternateWallet">
        {(field) => (
          <field.TextField
            label="ENS ou carteira secundária (opcional)"
            autoCapitalize="none"
            autoComplete="off"
            spellCheck={false}
            placeholder="ENS ou carteira secundária (opcional)"
            className={accountInput}
          />
        )}
      </form.AppField>

      <form.AppField name="provider">
        {(field) => (
          <field.SelectField
            label="Tipo de carteira"
            placeholder="Selecione uma carteira"
            options={PROVIDER_OPTIONS}
            required
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
            autoComplete="off"
            spellCheck={false}
            className={accountInput}
            format={(value) => value.toUpperCase()}
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
