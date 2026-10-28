import { Link } from '@tanstack/react-router'
import type * as React from 'react'

import {
  ActivityIcon,
  ChevronRightIcon,
  DangerTriangleIcon,
  DownloadIcon,
  HeartIcon,
  LocationIcon,
  LogoutIcon,
  ShoppingOutlinedIcon,
  UserOutlinedIcon,
} from '@/components/icons'
import { Unavailable } from '@/components/layout/unavailable'
import { useLogout } from '@/features/auth/api/use-logout'
import { cn } from '@/lib/utils'

export type AccountPage = 'profile' | 'wallets'

const row =
  'relative flex h-12 w-full items-center gap-3 px-4 text-left text-body text-text-accent lg:h-11.25'
const activeRow = 'before:absolute before:inset-y-0 before:left-0 before:w-1.5 before:bg-primary'

function Row({
  icon,
  children,
  chevron = true,
}: {
  icon: React.ReactNode
  children: React.ReactNode
  chevron?: boolean
}) {
  return (
    <>
      {icon}
      <span className="flex-1">{children}</span>
      {chevron && <ChevronRightIcon className="size-3.5 text-text-secondary lg:hidden" />}
    </>
  )
}

const icon = 'size-4.5 shrink-0'

/**
 * The "Meu perfil" menu (ACC-02): a 310 card beside the content from `lg`, a compact list on top of
 * the profile below it. Account items the deliverable does not have stay visible as unavailable
 * links, and "Sair" is a button, since it acts instead of navigating.
 */
export function AccountNav({ current, className }: { current: AccountPage; className?: string }) {
  const logout = useLogout()
  const here = (page: AccountPage) =>
    current === page ? ({ 'aria-current': 'page' } as const) : undefined

  return (
    <nav aria-label="Conta" className={cn('rounded-md bg-surface-card pb-1 lg:pb-1.5', className)}>
      <p className="px-2.5 pt-3 pb-2 text-title text-foreground lg:pt-2.5">Meu perfil</p>
      <ul>
        <li>
          <Link
            to="/profile"
            className={cn(row, current === 'profile' && activeRow)}
            {...here('profile')}
          >
            <Row icon={<UserOutlinedIcon className={icon} />}>Dados do perfil</Row>
          </Link>
        </li>
        <li>
          <Link
            to="/wallets"
            className={cn(row, current === 'wallets' && activeRow)}
            {...here('wallets')}
          >
            <Row icon={<LocationIcon className={icon} />}>Carteiras</Row>
          </Link>
        </li>
        <li>
          <Unavailable className={row}>
            <Row icon={<ShoppingOutlinedIcon className={icon} />}>Atividade</Row>
          </Unavailable>
        </li>
        <li>
          <Link to="/" search={{ favorites: 1 }} className={row}>
            <Row icon={<HeartIcon className={icon} />}>Lista de interesse</Row>
          </Link>
        </li>
        <li>
          <Unavailable className={row}>
            <Row icon={<ActivityIcon className={icon} />}>Ofertas</Row>
          </Unavailable>
        </li>
        <li>
          <Unavailable className={row}>
            <Row icon={<DownloadIcon className={icon} />}>Arquivos baixados</Row>
          </Unavailable>
        </li>
        <li>
          <Unavailable className={row}>
            <Row icon={<DangerTriangleIcon className={icon} />}>Suporte</Row>
          </Unavailable>
        </li>
      </ul>
      <div className="border-t border-border">
        <button
          type="button"
          className={cn(row, 'cursor-pointer font-bold')}
          onClick={() => {
            void logout()
          }}
        >
          <Row icon={<LogoutIcon className={icon} />} chevron={false}>
            Sair
          </Row>
        </button>
      </div>
    </nav>
  )
}
