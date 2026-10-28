import ArrowLeftIcon from '@/assets/icons/arrow-left.svg?react'
import MoreVerticalIcon from '@/assets/icons/menu.svg?react'
import { cn } from '@/lib/utils'

import type { IconProps } from './drawn'

// Figma only exports the left chevron and the vertical "more" glyph; other directions rotate them.

export function ChevronRightIcon({ className, ...props }: IconProps) {
  return <ArrowLeftIcon className={cn('rotate-180', className)} {...props} />
}

export function ChevronDownIcon({ className, ...props }: IconProps) {
  return <ArrowLeftIcon className={cn('-rotate-90', className)} {...props} />
}

export function ChevronUpIcon({ className, ...props }: IconProps) {
  return <ArrowLeftIcon className={cn('rotate-90', className)} {...props} />
}

export function MoreHorizontalIcon({ className, ...props }: IconProps) {
  return <MoreVerticalIcon className={cn('rotate-90', className)} {...props} />
}
