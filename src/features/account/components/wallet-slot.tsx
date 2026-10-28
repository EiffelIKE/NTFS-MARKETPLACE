import * as React from 'react'

import { submitForm } from '@/components/form/submit'
import { AlertCircleIcon } from '@/components/icons'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import type { Wallet, WalletRole } from '@/contracts'

import {
  COPIED_FIELDS,
  copyFromPrimary,
  walletDefaults,
  type CopiedField,
  type WalletFormValues,
} from '../model/wallet-form'
import { accountSubmit } from './account-styles'
import { useWalletForm } from './use-wallet-form'
import { WalletFields } from './wallet-fields'

interface WalletSlotProps {
  kind: WalletRole
  /** The wallet registered in this slot, if any. */
  wallet: Wallet | undefined
  /** The primary wallet, which the secondary slot can copy from. */
  primary: Wallet | undefined
}

const TITLES: Record<WalletRole, string> = {
  primary: 'Carteira principal',
  secondary: 'Carteira secundária',
}

/**
 * One wallet section (ACC-15, ACC-16, ACC-18; spec 08 design §6). The primary's form is always
 * open, for creation or edit. An empty secondary shows its empty state, and "Adicionar" or
 * "Igual à carteira principal" opens the form, which "Cancelar" closes again.
 */
export function WalletSlot({ kind: role, wallet, primary }: WalletSlotProps) {
  const headingId = React.useId()
  const sameId = React.useId()
  const hintId = React.useId()
  const { form, formRef, notice } = useWalletForm({ role, wallet })
  const [open, setOpen] = React.useState(false)
  const [same, setSame] = React.useState(false)
  const copied = React.useRef<Pick<WalletFormValues, CopiedField> | null>(null)

  const isPrimary = role === 'primary'
  const formVisible = isPrimary || wallet !== undefined || open
  const canCopy = primary !== undefined

  // Opening an empty slot with "Adicionar" puts the user in its first field.
  const focusOnOpen = React.useRef(false)
  React.useEffect(() => {
    if (!open || !focusOnOpen.current) return
    focusOnOpen.current = false
    formRef.current?.querySelector<HTMLElement>('input, button[role="combobox"]')?.focus()
  }, [open, formRef])

  const copyOn = () => {
    if (!primary) return
    const values = copyFromPrimary(primary)
    copied.current = values
    for (const name of COPIED_FIELDS) form.setFieldValue(name, values[name])
    setSame(true)
    setOpen(true)
  }

  // Unchecking removes the copied values the user did not change since.
  const copyOff = () => {
    const values = copied.current
    if (values) {
      for (const name of COPIED_FIELDS) {
        if (form.getFieldValue(name) === values[name]) form.setFieldValue(name, '')
      }
    }
    copied.current = null
    setSame(false)
  }

  const cancel = () => {
    copied.current = null
    setSame(false)
    setOpen(false)
    form.reset(walletDefaults())
  }

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <h2 id={headingId} className="text-title font-bold text-foreground">
            {TITLES[role]}
          </h2>
          {!isPrimary && wallet === undefined && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id={sameId}
                  checked={same}
                  disabled={!canCopy}
                  aria-describedby={canCopy ? undefined : hintId}
                  onCheckedChange={(checked) => {
                    if (checked === true) copyOn()
                    else copyOff()
                  }}
                />
                <Label htmlFor={sameId} className="text-body">
                  Igual à carteira principal
                </Label>
              </div>
              {!formVisible && (
                <Button
                  type="button"
                  variant="link"
                  className="font-bold"
                  onClick={() => {
                    focusOnOpen.current = true
                    setOpen(true)
                  }}
                >
                  Adicionar
                </Button>
              )}
            </div>
          )}
        </div>
        {isPrimary && (
          <p className="text-body text-secondary">
            Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados.
          </p>
        )}
        {!isPrimary && !formVisible && (
          <>
            <p className="text-body text-secondary">
              Você ainda não adicionou uma carteira secundária.
            </p>
            {!canCopy && (
              <p id={hintId} className="text-caption-sm text-text-secondary">
                Cadastre a carteira principal primeiro.
              </p>
            )}
          </>
        )}
      </div>

      {formVisible && (
        <form
          ref={formRef}
          noValidate
          className="flex flex-col gap-8"
          onSubmit={(event) => {
            event.preventDefault()
            event.stopPropagation()
            void submitForm(form)
          }}
        >
          {notice && (
            <Alert variant="info">
              <AlertCircleIcon />
              <AlertDescription>{notice}</AlertDescription>
            </Alert>
          )}
          <form.AppForm>
            <form.FormAlert />
          </form.AppForm>

          <WalletFields form={form} />

          <div className="flex flex-col gap-4 lg:flex-row">
            <form.AppForm>
              <form.SubmitButton className={accountSubmit}>Salvar carteira</form.SubmitButton>
            </form.AppForm>
            {!isPrimary && wallet === undefined && (
              <Button type="button" variant="outline" className="max-lg:h-12.5" onClick={cancel}>
                Cancelar
              </Button>
            )}
          </div>
        </form>
      )}
    </section>
  )
}
