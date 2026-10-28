import { useQueryClient } from '@tanstack/react-query'
import * as React from 'react'

import { notify } from '@/components/feedback'
import { useAppForm } from '@/components/form/app-form'
import { applyServerErrors, setFormError } from '@/components/form/server-errors'
import { useFormFocus } from '@/components/form/use-form-focus'
import { formValidation } from '@/components/form/validation'
import type { Wallet, WalletRole } from '@/contracts'
import { isApiError } from '@/lib/http/errors'

import { accountKeys } from '../api/account-keys'
import { useSaveWallet } from '../api/wallets-mutations'
import { walletDefaults, WalletFormSchema } from '../model/wallet-form'
import { useAccountUserId } from '../model/use-account'

export const ROLE_TAKEN_NOTICE = 'Esta carteira já foi cadastrada. Atualizamos os dados.'

/**
 * The form of one wallet slot (ACC-16 – ACC-20; spec 08 design §6). The hook lives in the slot,
 * not in the form component, because the secondary slot's "Igual à carteira principal" control
 * sits in the header and writes into the form before the form is shown.
 */
export function useWalletForm({ role, wallet }: { role: WalletRole; wallet: Wallet | undefined }) {
  const queryClient = useQueryClient()
  const userId = useAccountUserId()
  const save = useSaveWallet()
  const { formRef, focusFirstInvalid } = useFormFocus()
  // `WALLET_ROLE_TAKEN` is reported outside the form: the refetch that follows resets it.
  const [notice, setNotice] = React.useState<string | null>(null)

  const form = useAppForm({
    defaultValues: walletDefaults(wallet),
    validationLogic: formValidation(),
    validators: { onDynamic: WalletFormSchema },
    onSubmitInvalid: () => {
      focusFirstInvalid()
    },
    onSubmit: async ({ value, formApi }) => {
      setNotice(null)
      const fields = WalletFormSchema.parse(value)
      try {
        const saved = await save.mutateAsync({ walletId: wallet?.id, role, fields })
        notify.success('Carteira salva.')
        formApi.reset(walletDefaults(saved))
      } catch (error) {
        if (isApiError(error) && error.code === 'WALLET_ROLE_TAKEN') {
          // Another tab created this slot: show its data instead (ACC-19).
          setNotice(ROLE_TAKEN_NOTICE)
          if (userId) {
            void queryClient.invalidateQueries({ queryKey: accountKeys.wallets(userId) })
          }
          return
        }
        if (applyServerErrors(formApi, error, { WALLET_DUPLICATE: 'address' })) {
          focusFirstInvalid()
          return
        }
        setFormError(
          formApi,
          isApiError(error) ? error.message : 'Algo deu errado. Tente novamente.',
        )
      }
    },
  })

  // The slot shows server data: when the wallet changes underneath the form (a refetch after
  // `WALLET_ROLE_TAKEN`, an edit in another tab), the form starts from it.
  const seen = React.useRef(wallet ? `${wallet.id}@${wallet.updatedAt}` : null)
  React.useEffect(() => {
    if (!wallet) return
    const stamp = `${wallet.id}@${wallet.updatedAt}`
    if (seen.current === stamp) return
    seen.current = stamp
    form.reset(walletDefaults(wallet))
  }, [form, wallet])

  return { form, formRef, notice }
}

export type WalletFormHook = ReturnType<typeof useWalletForm>
