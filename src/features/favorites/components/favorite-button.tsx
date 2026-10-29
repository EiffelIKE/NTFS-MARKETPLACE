import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'

import { HeartFilledIcon, HeartIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import type { NftSummary } from '@/contracts'
import { useAccountUserId } from '@/features/account/model/use-account'
import { useSession } from '@/features/auth/model/use-session'
import { actionClass } from '@/features/catalog/components/product-card'
import { cn } from '@/lib/utils'

import { currentFavorite } from '../api/favorites-cache'
import { useToggleFavorite } from '../api/use-toggle-favorite'
import { useFavoriteState } from '../model/use-is-favorite'

/** Where the control sits (spec 06 design §8); the behavior is the same everywhere. */
export type FavoriteVariant = 'button' | 'circle' | 'card-desktop' | 'card-mobile'

const iconVariants: Record<Exclude<FavoriteVariant, 'button'>, string> = {
  circle:
    'size-8.75 rounded-full bg-surface-card text-primary [&_svg]:size-5 hover:bg-surface-raised',
  'card-desktop': `${actionClass} text-primary`,
  'card-mobile':
    'relative size-7 rounded-full bg-ink/70 text-primary after:absolute after:-inset-2 [&_svg]:size-4',
}

/**
 * The favorite toggle (DET-20 – DET-22): a pressed-state button over the optimistic mutation. A
 * guest sees the same control; activating it goes to login and comes back to this URL, and the
 * item never shows as favorited.
 */
export function FavoriteButton({
  nft,
  variant,
  className,
}: {
  nft: Pick<NftSummary, 'id' | 'name'>
  variant: FavoriteVariant
  className?: string
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const status = useSession().status
  const userId = useAccountUserId()
  const { pressed: favorite, known, loading, retry } = useFavoriteState(nft.id)
  const toggle = useToggleFavorite(nft.id)

  const onClick = () => {
    if (status === 'guest') {
      void router.navigate({ to: '/login', search: { redirect: router.state.location.href } })
      return
    }
    // The list has not arrived (or failed): the click cannot know what "toggle" means. The button
    // stays focusable (`aria-disabled`, not `disabled`), and a failed read is asked for again.
    if (!known || userId === undefined) {
      if (!loading) retry()
      return
    }
    // Read the last intent or the cache, not the rendered value: two quick clicks must flip twice
    // even when React has not re-rendered between them (F1).
    toggle.mutate(!currentFavorite(queryClient, userId, nft.id))
  }

  const Icon = favorite ? HeartFilledIcon : HeartIcon

  if (variant === 'button') {
    return (
      <Button
        type="button"
        variant="outline"
        aria-pressed={favorite}
        aria-busy={loading || undefined}
        aria-disabled={!known || undefined}
        onClick={onClick}
        className={cn('min-w-32.5 px-4', !known && 'cursor-progress', className)}
      >
        <Icon />
        {favorite ? 'Favoritado' : 'Favoritar'}
      </Button>
    )
  }
  return (
    <button
      type="button"
      aria-pressed={favorite}
      aria-label={`Favoritar ${nft.name}`}
      aria-busy={loading || undefined}
      aria-disabled={!known || undefined}
      onClick={onClick}
      className={cn(
        'flex shrink-0 cursor-pointer items-center justify-center',
        !known && 'cursor-progress',
        iconVariants[variant],
        className,
      )}
    >
      <Icon />
    </button>
  )
}
