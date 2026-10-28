// Icon registry (spec 01 design §5). Figma exports normalized to `currentColor`: size with
// `className` (`size-5`), color with `text-*`. Icons are `aria-hidden`; label the control instead.

export { default as ActivityIcon } from '@/assets/icons/activity.svg?react'
export { default as ArrowLeftIcon } from '@/assets/icons/arrow-left.svg?react'
export { default as ArrowRightIcon } from '@/assets/icons/arrow-right.svg?react'
export { default as BagIcon } from '@/assets/icons/shop.svg?react'
export { default as CartIcon } from '@/assets/icons/cart.svg?react'
export { default as DangerTriangleIcon } from '@/assets/icons/danger-triangle.svg?react'
export { default as DeleteIcon } from '@/assets/icons/delete.svg?react'
export { default as DownloadIcon } from '@/assets/icons/download.svg?react'
export { default as EmptyImageIcon } from '@/assets/icons/empty-image.svg?react'
export { default as EyeOffIcon } from '@/assets/icons/eye-off.svg?react'
export { default as FilterIcon } from '@/assets/icons/filter.svg?react'
export { default as HeartFilledIcon } from '@/assets/icons/heart-filled.svg?react'
export { default as HeartIcon } from '@/assets/icons/heart.svg?react'
export { default as HomeIcon } from '@/assets/icons/home.svg?react'
export { default as LocationIcon } from '@/assets/icons/location.svg?react'
export { default as LogoutIcon } from '@/assets/icons/logout.svg?react'
export { default as MinusIcon } from '@/assets/icons/minus.svg?react'
export { default as MoreVerticalIcon } from '@/assets/icons/menu.svg?react'
export { default as PlusIcon } from '@/assets/icons/plus.svg?react'
export { default as ScanIcon } from '@/assets/icons/scan.svg?react'
export { default as SearchIcon } from '@/assets/icons/search.svg?react'
export { default as ShoppingOutlinedIcon } from '@/assets/icons/shopping-outlined.svg?react'
export { default as StarIcon } from '@/assets/icons/star.svg?react'
export { default as ThankYouIcon } from '@/assets/icons/thank-you.svg?react'
export { default as UserIcon } from '@/assets/icons/user.svg?react'
export { default as UserOutlinedIcon } from '@/assets/icons/user-outlined.svg?react'
export { default as WalletIcon } from '@/assets/icons/wallet.svg?react'

// Footer social networks
export { default as FacebookIcon } from '@/assets/social/facebook.svg?react'
export { default as InstagramIcon } from '@/assets/social/instagram.svg?react'
export { default as LinkedinIcon } from '@/assets/social/linkedin.svg?react'
export { default as TwitterIcon } from '@/assets/social/twitter.svg?react'
export { default as YoutubeIcon } from '@/assets/social/union.svg?react'

// Details share row (different geometry from the footer set)
export { default as MailIcon } from '@/assets/share_icons/mail.svg?react'
export { default as ShareLinkedinIcon } from '@/assets/share_icons/linkedin.svg?react'
export { default as ShareTwitterIcon } from '@/assets/share_icons/twitter.svg?react'

// Auth brand marks keep their brand colors
export { default as FacebookMarkIcon } from '@/assets/social_login/facebook.svg?react'
export { default as GoogleMarkIcon } from '@/assets/social_login/google.svg?react'

export { ChevronDownIcon, ChevronRightIcon, ChevronUpIcon, MoreHorizontalIcon } from './rotated'
export {
  AlertCircleIcon,
  CheckCircleIcon,
  CheckIcon,
  CloseIcon,
  EyeIcon,
  SpinnerIcon,
  type IconProps,
} from './drawn'
