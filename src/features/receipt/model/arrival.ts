declare module '@tanstack/react-router' {
  interface HistoryState {
    /** Set by checkout when it replaces itself with the receipt of the order just paid (RCPT-15). */
    fromCheckout?: boolean
  }
}

/** The `state` checkout passes when it navigates to a confirmed order. */
export const CHECKOUT_ARRIVAL = { fromCheckout: true } as const
