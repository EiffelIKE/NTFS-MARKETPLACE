import type * as React from 'react'

import type { Image } from '@/contracts'
import { cn } from '@/lib/utils'

import { slideLabel } from '../model/slides'

// The scroll-snap slider behind both the mobile gallery and the zoom dialog (DET-05): one slide
// per image, each as wide as the track, so the scroll position is the current image. Its state
// lives in `useSlideTrack`.

/** The scroller: a labelled, focusable region (the arrow keys scroll it, as axe asks). */
export function SlideTrack({
  images,
  track,
  className,
  slideClassName,
  children,
}: {
  images: readonly Image[]
  track: React.Ref<HTMLDivElement>
  className?: string
  slideClassName?: string
  children: (image: Image, position: number) => React.ReactNode
}) {
  return (
    <div
      ref={track}
      // Focusable so the keyboard can scroll it (arrow keys), as axe's scrollable-region rule asks.
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a scroll container must be reachable
      tabIndex={0}
      role="region"
      aria-label="Imagens do NFT"
      className={cn(
        'flex snap-x snap-mandatory [scrollbar-width:none] overflow-x-auto overscroll-x-contain',
        className,
      )}
    >
      {images.map((image, position) => (
        <div
          key={image.url}
          role="group"
          aria-roledescription="slide"
          aria-label={slideLabel(position, images.length)}
          className={cn('w-full shrink-0 snap-center', slideClassName)}
        >
          {children(image, position)}
        </div>
      ))}
    </div>
  )
}

/** One dot button per slide; the current one is stretched and carries `aria-current`. */
export function SlideDots({
  count,
  active,
  onSelect,
  className,
}: {
  count: number
  active: number
  onSelect: (position: number) => void
  className?: string
}) {
  return (
    <div className={cn('flex justify-center', className)}>
      {Array.from({ length: count }, (_, position) => (
        <button
          key={position}
          type="button"
          aria-label={`Ver imagem ${String(position + 1)} de ${String(count)}`}
          aria-current={position === active ? 'true' : undefined}
          onClick={() => {
            onSelect(position)
          }}
          className="flex size-6 cursor-pointer items-center justify-center"
        >
          <span
            aria-hidden="true"
            className={cn(
              'h-1.75 rounded-full bg-primary transition-[width] motion-reduce:transition-none',
              position === active ? 'w-4' : 'w-1.75 opacity-50',
            )}
          />
        </button>
      ))}
    </div>
  )
}
