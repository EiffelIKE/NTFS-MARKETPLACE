import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/nfts/$nftId')({
  staticData: {
    shell: { nav: 'market', headerDivider: false, mobile: { kind: 'inner', trailing: 'favorite' } },
  },
  head: () => ({ meta: [{ title: 'Detalhes do NFT · KURIO' }] }),
  component: NftDetailsPage,
})

function NftDetailsPage() {
  return (
    <div>
      <h1>Detalhes do NFT</h1>
    </div>
  )
}
