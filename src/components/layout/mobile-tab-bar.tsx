import { Link } from '@tanstack/react-router'
import type * as React from 'react'

import { BagIcon, HeartIcon, HomeIcon, ScanIcon, UserIcon } from '@/components/icons'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

import { cartLabel } from './cart-label'
import type { MobileTab } from './shell-config'
import { Unavailable } from './unavailable'

const item =
  'relative flex size-12 flex-col items-center justify-center text-text-secondary after:absolute after:bottom-1 after:size-1 after:rounded-full'
const itemActive = 'text-text-accent after:bg-text-accent'

export interface MobileTabBarProps extends React.ComponentProps<'nav'> {
  active?: MobileTab | undefined
  cartCount: number
  onSearch?: (() => void) | undefined
}

/**
 * Bottom tab bar below `lg` (DS-27): notched bar with the center search button. No visible labels
 * (Figma); each item has an accessible name, and the active one adds a dot (non-color cue).
 */
export function MobileTabBar({
  active,
  cartCount,
  onSearch,
  className,
  ...props
}: MobileTabBarProps) {
  const current = (tab: MobileTab) =>
    active === tab ? ({ 'aria-current': 'page' } as const) : undefined

  return (
    <nav
      aria-label="Principal"
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 h-[calc(126px+env(safe-area-inset-bottom))]',
        className,
      )}
      {...props}
    >
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-7.75 bottom-0 rounded-t-[32px] bg-surface-card tab-bar-notch"
      />
      {/* Figma icon centers 46 / 118 / FAB 207 / 301 / 364: kept symmetric around the FAB. */}
      <ul className="relative grid h-full grid-cols-[48px_48px_1fr_48px_48px] items-start gap-x-6 px-5.5 pt-13">
        <li className="flex justify-center">
          <Link
            to="/"
            aria-label="Início"
            className={cn(item, active === 'home' && itemActive)}
            {...current('home')}
          >
            <HomeIcon className="size-5" />
          </Link>
        </li>
        <li className="flex justify-center">
          {/* Favorites mode of the catalog (spec 05); a visitor is sent to sign in first. */}
          <Link
            to="/"
            search={{ favorites: 1 }}
            aria-label="Favoritos"
            className={cn(item, active === 'favorites' && itemActive)}
            {...current('favorites')}
          >
            <HeartIcon className="size-5" />
          </Link>
        </li>
        <li className="flex justify-center">
          {onSearch ? (
            <button
              type="button"
              aria-label="Buscar"
              onClick={onSearch}
              className="absolute top-0 left-1/2 flex size-16.25 -translate-x-1/2 cursor-pointer items-center justify-center rounded-full bg-primary-soft text-foreground"
            >
              <ScanIcon className="h-6 w-6.75" />
            </button>
          ) : (
            <Unavailable
              as="button"
              aria-label="Buscar"
              className="absolute top-0 left-1/2 flex size-16.25 -translate-x-1/2 items-center justify-center rounded-full bg-primary-soft text-foreground"
            >
              <ScanIcon className="h-6 w-6.75" />
            </Unavailable>
          )}
        </li>
        <li className="flex justify-center">
          <Link
            to="/cart"
            aria-label={cartLabel(cartCount)}
            className={cn(item, active === 'cart' && itemActive)}
            {...current('cart')}
          >
            <BagIcon className="size-5" />
            {cartCount > 0 && (
              <Badge variant="count" className="absolute top-1 right-1" aria-hidden="true">
                {cartCount > 99 ? '99+' : cartCount}
              </Badge>
            )}
          </Link>
        </li>
        <li className="flex justify-center">
          <Link
            to="/profile"
            aria-label="Perfil"
            className={cn(item, active === 'profile' && itemActive)}
            {...current('profile')}
          >
            <UserIcon className="size-5" />
          </Link>
        </li>
      </ul>
    </nav>
  )
}
