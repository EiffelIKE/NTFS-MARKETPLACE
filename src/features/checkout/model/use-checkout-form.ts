import { useSelector } from '@tanstack/react-form'
import * as React from 'react'

import { useAppForm } from '@/components/form/app-form'
import { formValidation } from '@/components/form/validation'
import type { Wallet } from '@/contracts'
import { session } from '@/features/auth/model/instance'

import { draftStore } from './draft-store'
import { CheckoutFormSchema, walletBaseline, walletSwitchPatch, type CheckoutValues } from './form'

const DRAFT_DELAY_MS = 300

const same = (a: CheckoutValues, b: CheckoutValues) =>
  (Object.keys(a) as (keyof CheckoutValues)[]).every((key) => a[key] === b[key])

/** Whether `userId` is still the signed-in user: a sign-out must not write the draft back. */
function stillSignedIn(userId: string): boolean {
  const state = session.get()
  return state.status === 'authenticated' && state.user.id === userId
}

export interface CheckoutFormOptions {
  userId: string
  /** What the form starts with: the draft if there is one, else the prefill. */
  initial: CheckoutValues
  /** What the profile and the chosen wallet suggest; a field that differs was edited. */
  suggested: CheckoutValues
  /** The form is valid and the user asked to review (CHK-18). */
  onValid: () => void
  /** The submit found errors (CHK-07). */
  onInvalid: () => void
}

/**
 * The checkout form (spec 09 design §4) on the shared form layer: Zod validation with the
 * contract's rules, blur first and change after the first submit. It also owns the draft (CHK-09)
 * and the wallet switch. The draft is written 300 ms after the last change, only while the values
 * differ from what the profile and wallet suggest, so a pristine form always takes the freshest
 * wallet data. What the user *edited* is what differs from the wallet's suggestion (`baseline`),
 * so nothing has to be tracked field by field.
 */
export function useCheckoutForm({
  userId,
  initial,
  suggested,
  onValid,
  onInvalid,
}: CheckoutFormOptions) {
  const baseline = React.useRef(suggested)
  const suppressDraft = React.useRef(false)

  const form = useAppForm({
    defaultValues: initial,
    validationLogic: formValidation(),
    validators: { onDynamic: CheckoutFormSchema },
    onSubmitInvalid: onInvalid,
    onSubmit: onValid,
  })

  const values = useSelector(form.store, (state) => state.values)
  const latest = React.useRef(values)
  React.useEffect(() => {
    latest.current = values
  })

  const persist = React.useCallback(
    (next: CheckoutValues) => {
      if (suppressDraft.current || !stillSignedIn(userId)) return
      if (same(next, baseline.current)) draftStore.clear(userId)
      else draftStore.write(userId, { values: next })
    },
    [userId],
  )

  React.useEffect(() => {
    const timer = setTimeout(() => {
      persist(values)
    }, DRAFT_DELAY_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [values, persist])

  // A reload or a navigation inside the delay must not lose the last keystrokes.
  React.useEffect(
    () => () => {
      persist(latest.current)
    },
    [persist],
  )

  const switchWallet = React.useCallback(
    (wallet: Wallet) => {
      const patch = walletSwitchPatch(wallet, form.state.values, baseline.current)
      for (const [name, value] of Object.entries(patch)) {
        form.setFieldValue(name as keyof CheckoutValues, value)
      }
      baseline.current = walletBaseline(baseline.current, wallet)
    },
    [form],
  )

  return {
    form,
    values,
    switchWallet,
    /** Stops the draft from being written again: an order exists, the draft is gone (CHK-09). */
    discardDraft: () => {
      suppressDraft.current = true
      draftStore.clear(userId)
    },
  }
}

export type CheckoutFormApi = ReturnType<typeof useCheckoutForm>['form']
