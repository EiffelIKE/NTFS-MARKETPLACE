import type * as React from 'react'

import { cn } from '@/lib/utils'

import { AccountNav, type AccountPage } from './account-nav'

/**
 * The frame of both account screens (spec 08 design §2, §8): the menu card (310) beside the
 * content from `lg`; below it the profile keeps the menu as a list on top, and the wallets screen
 * is an inner page without it (its top bar goes back).
 */
export function AccountLayout({
  current,
  children,
}: {
  current: AccountPage
  children: React.ReactNode
}) {
  const menuOnPhones = current === 'profile'
  return (
    <div className="mx-auto w-full max-w-150 px-6 lg:grid lg:max-w-page lg:grid-cols-[var(--spacing-sidebar)_minmax(0,1fr)] lg:items-start lg:gap-x-7">
      <AccountNav current={current} className={cn(!menuOnPhones && 'max-lg:hidden')} />
      <div className={cn('min-w-0', menuOnPhones ? 'max-lg:mt-8' : 'max-lg:mt-4')}>{children}</div>
    </div>
  )
}
