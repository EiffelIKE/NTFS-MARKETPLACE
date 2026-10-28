import { useCheckoutContext } from './checkout-context'

/** Whether the quote on screen belongs to an earlier cart or network, or is being refreshed. */
export function useQuoteState() {
  const { quote } = useCheckoutContext()
  const loading = quote.isPending
  const outdated = !loading && (quote.isPlaceholderData || quote.isFetching)
  const failed = quote.isError && quote.data === undefined
  return { loading, outdated, failed }
}
