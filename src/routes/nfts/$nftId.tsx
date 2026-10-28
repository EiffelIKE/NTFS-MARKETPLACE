import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/nfts/$nftId')({
  head: () => ({ meta: [{ title: 'Detalhes do NFT · KURIO' }] }),
  component: NftDetailsPage,
})

function NftDetailsPage() {
  return (
    <main>
      <h1>Detalhes do NFT</h1>
    </main>
  )
}
