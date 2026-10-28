import * as React from 'react'

import type { UseQueryResult } from '@tanstack/react-query'

import type { Cart, NetworkList, Quote, Wallet } from '@/contracts'

import type { CheckoutValues } from '../model/form'
import type { CheckoutFormApi } from '../model/use-checkout-form'

/** What the form's regions share: the form, the chosen wallet and the data around it. */
export interface CheckoutContextValue {
  form: CheckoutFormApi
  values: CheckoutValues
  cart: Cart
  wallets: readonly Wallet[]
  /** The wallet the form currently pays with. */
  wallet: Wallet
  networks: UseQueryResult<NetworkList>
  /** The quote for the chosen network (CHK-12). */
  quote: UseQueryResult<Quote>
  signedIn: boolean
  switchWallet: (wallet: Wallet) => void
}

export const CheckoutContext = React.createContext<CheckoutContextValue | null>(null)

export function useCheckoutContext(): CheckoutContextValue {
  const value = React.useContext(CheckoutContext)
  if (!value) throw new Error('useCheckoutContext must be used inside <CheckoutForm>')
  return value
}
