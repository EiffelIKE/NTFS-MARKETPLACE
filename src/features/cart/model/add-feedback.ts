import { notify } from '@/components/feedback'
import type { AddErrorOutcome } from '@/features/nft-details/model/add-errors'

/** "Adicionado ao carrinho" with a way to the cart (DET-15), as one toast. */
export function notifyAdded(viewCart: () => void): void {
  notify.success('Adicionado ao carrinho', {
    action: { label: 'Ver carrinho', onClick: viewCart },
  })
}

/**
 * The toast form of a failed add, for the places with no inline slot (the catalog card). The
 * refetches the outcome asks for are the caller's. A session error shows nothing: spec 04's expiry
 * flow is already talking to the user.
 */
export function notifyAddError(outcome: AddErrorOutcome, retry: () => void): void {
  switch (outcome.kind) {
    case 'sold-out':
    case 'limit':
      notify.error(outcome.message)
      return
    case 'not-found':
      notify.error('Este NFT não está mais disponível.')
      return
    case 'session':
      return
    case 'failed':
      notify.error(outcome.message, { action: { label: 'Tentar novamente', onClick: retry } })
  }
}
