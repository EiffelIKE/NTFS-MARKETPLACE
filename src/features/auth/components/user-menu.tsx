import { Link } from '@tanstack/react-router'

import { HrefLink } from '@/components/href-link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import { useLogout } from '../api/use-logout'

/**
 * The signed-in header control (AUTH-21): avatar and name open a menu. Radix gives arrow-key
 * navigation, `Esc` and focus return; the content comes from `useSession()`, so a profile edit
 * (spec 08, `session.updateUser`) shows up without a reload. It is non-modal (spec 11): a modal
 * menu hides the page with `aria-hidden` while its links stay focusable, which axe rightly reports
 * (`aria-hidden-focus`), and a menu needs no focus trap: `Tab` simply closes it, as in a menu bar.
 */
export function UserMenu({ name, avatarUrl }: { name: string; avatarUrl?: string | undefined }) {
  const logout = useLogout()

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Conta de ${name}`}
          className="max-w-48 gap-2 px-2"
        >
          <Avatar className="size-6">
            {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
            <AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
          <span title={name} className="max-w-40 truncate text-body font-medium">
            {name}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem asChild>
          <Link to="/profile">Meu perfil</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/wallets">Carteiras</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          {/* `/` gets its `favorites` search from spec 05, so this target is a plain href. */}
          <HrefLink href="/?favorites=1">Lista de interesse</HrefLink>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            void logout()
          }}
        >
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
