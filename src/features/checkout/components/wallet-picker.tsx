import { Link } from '@tanstack/react-router'

import { MoreVerticalIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { NETWORK_LABELS, type Wallet } from '@/contracts'
import { cn } from '@/lib/utils'

import { useWalletConnection } from '../api/use-wallet-connection'
import { shortAddress } from '../model/format'
import { useCheckoutContext } from './checkout-context'

/**
 * Desktop "Usar outra carteira?" (CHK-10; open question 2): checked pays with the secondary wallet
 * and refills the wallet fields, unchecked goes back to the primary. Without a second wallet it is
 * disabled and says where to add one.
 */
export function WalletToggle() {
  const { wallets, wallet, switchWallet } = useCheckoutContext()
  const primary = wallets.find((candidate) => candidate.role === 'primary')
  const secondary = wallets.find((candidate) => candidate.role === 'secondary')
  const hintId = 'other-wallet-hint'

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-3">
        <Checkbox
          id="use-other-wallet"
          checked={wallet.role === 'secondary'}
          disabled={!secondary}
          aria-describedby={secondary ? undefined : hintId}
          onCheckedChange={(checked) => {
            const next = checked === true ? secondary : (primary ?? wallets[0])
            if (next) switchWallet(next)
          }}
        />
        <Label htmlFor="use-other-wallet" className="text-body-md text-foreground">
          Usar outra carteira?
        </Label>
      </div>
      {!secondary && (
        <p id={hintId} className="pl-7.5 text-caption-sm text-text-secondary">
          Você só tem uma carteira cadastrada.{' '}
          <Link to="/wallets" className="text-text-accent hover:underline">
            Adicionar outra
          </Link>
        </p>
      )}
    </div>
  )
}

function WalletCard({ wallet, selected }: { wallet: Wallet; selected: boolean }) {
  const titleId = `wallet-card-${wallet.id}-title`
  const detailId = `wallet-card-${wallet.id}-detail`
  return (
    <div
      data-testid="wallet-card"
      data-selected={selected || undefined}
      className="relative flex items-center gap-3 rounded-artwork-mobile bg-surface-card pr-12 pl-4"
    >
      <RadioGroupItem
        id={`wallet-card-${wallet.id}`}
        value={wallet.id}
        aria-labelledby={titleId}
        aria-describedby={detailId}
      />
      <Label
        htmlFor={`wallet-card-${wallet.id}`}
        className="flex min-w-0 flex-1 cursor-pointer flex-col items-start py-4.5 font-normal"
      >
        <span id={titleId} className="text-body-lg font-bold text-foreground">
          {wallet.nickname}
        </span>
        <span id={detailId} className="flex flex-col text-body text-text-secondary">
          <span className="truncate">{wallet.alternateWallet ?? shortAddress(wallet.address)}</span>
          <span>Rede {NETWORK_LABELS[wallet.network]}</span>
        </span>
      </Label>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Opções de ${wallet.nickname}`}
            className="absolute top-2 right-1 text-text-secondary"
          >
            <MoreVerticalIcon className="size-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link to="/wallets">Editar carteira</Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

/**
 * Mobile wallet cards (Figma "Pagamento com carteira", CHK-10): the registered wallets as a radio
 * group under "Carteira conectada" and "Trocar carteira" (which opens the wallets screen, spec 08).
 */
export function WalletCards({ className }: { className?: string }) {
  const { wallets, wallet, switchWallet, values } = useCheckoutContext()
  const connection = useWalletConnection({
    walletId: wallet.id,
    provider: values.provider,
    network: values.network,
  })
  return (
    <section aria-labelledby="wallet-cards-title" className={cn('flex flex-col gap-4', className)}>
      <div className="flex items-center justify-between gap-4">
        <h2 id="wallet-cards-title" className="text-title text-foreground">
          {connection.connected ? 'Carteira conectada' : 'Carteira'}
        </h2>
        <Link to="/wallets" className="text-body-lg font-bold text-text-accent hover:underline">
          Trocar carteira
        </Link>
      </div>
      <RadioGroup
        aria-labelledby="wallet-cards-title"
        value={wallet.id}
        onValueChange={(id) => {
          const next = wallets.find((candidate) => candidate.id === id)
          if (next) switchWallet(next)
        }}
      >
        {wallets.map((candidate) => (
          <WalletCard key={candidate.id} wallet={candidate} selected={candidate.id === wallet.id} />
        ))}
      </RadioGroup>
    </section>
  )
}
