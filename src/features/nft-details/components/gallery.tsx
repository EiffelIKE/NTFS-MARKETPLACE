import * as React from 'react'

import { NftImage } from '@/components/nft-image'
import type { NftDetail } from '@/contracts'
import { useMediaQuery } from '@/hooks/use-media-query'
import { cn } from '@/lib/utils'

import { ZoomDialog } from './zoom-dialog'

/** The main image's box: 444 square with the artwork inset by 20 on desktop, edge to edge on mobile. */
export const galleryMainClass =
  'relative aspect-square w-full overflow-hidden rounded-card-mobile bg-surface-card lg:min-w-0 lg:flex-1 lg:self-start lg:rounded-none lg:p-5'

/**
 * Images of the NFT (DET-05). Desktop: up to four thumbnail buttons beside the main image, where
 * choosing one swaps the image. Mobile: a swipeable scroll-snap track with one dot per image.
 * Both have the zoom button. Only one composition is mounted, so the LCP image loads once.
 */
export function Gallery({ nft, className }: { nft: NftDetail; className?: string | undefined }) {
  const wide = useMediaQuery('(min-width: 1024px)')
  const images = nft.images
  const [index, setIndex] = React.useState(0)
  const current = Math.min(index, images.length - 1)
  const image = images[current] ?? images[0]
  if (!image) return null

  const zoom = (
    <ZoomDialog
      name={nft.name}
      image={image}
      index={current}
      total={images.length}
      className={wide ? 'absolute top-3.75 right-3.75 z-10' : 'absolute top-3.75 right-9.75 z-10'}
    />
  )

  if (wide) {
    return (
      <div className={cn('flex gap-7', className)}>
        {images.length > 1 && (
          <ul className="flex w-25 shrink-0 flex-col gap-4">
            {images.slice(0, 4).map((thumb, position) => (
              <li key={thumb.url}>
                <button
                  type="button"
                  aria-pressed={position === current}
                  aria-label={`Imagem ${String(position + 1)} de ${String(images.length)}`}
                  onClick={() => {
                    setIndex(position)
                  }}
                  className={cn(
                    'block aspect-square w-full cursor-pointer overflow-hidden rounded-md border border-transparent bg-surface-card p-0.5',
                    position === current ? 'border-primary' : 'hover:border-border-soft',
                  )}
                >
                  <NftImage
                    image={thumb}
                    slot="thumb"
                    alt=""
                    className="size-full rounded-sm object-cover"
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div data-testid="gallery-main" className={galleryMainClass}>
          <NftImage
            image={image}
            slot="gallery"
            priority
            className="size-full rounded-artwork object-cover"
          />
          {zoom}
        </div>
      </div>
    )
  }
  return <MobileTrack nft={nft} onIndexChange={setIndex} zoom={zoom} className={className} />
}

function MobileTrack({
  nft,
  onIndexChange,
  zoom,
  className,
}: {
  nft: NftDetail
  onIndexChange: (index: number) => void
  zoom: React.ReactNode
  className?: string | undefined
}) {
  const track = React.useRef<HTMLDivElement>(null)
  const [active, setActive] = React.useState(0)
  const { images } = nft

  // The slide the track is scrolled to is the active one (the track is as wide as a slide).
  React.useEffect(() => {
    const root = track.current
    if (!root || images.length < 2) return
    const update = () => {
      const next = Math.min(images.length - 1, Math.round(root.scrollLeft / root.clientWidth))
      setActive(next)
      onIndexChange(next)
    }
    root.addEventListener('scroll', update, { passive: true })
    return () => {
      root.removeEventListener('scroll', update)
    }
  }, [images.length, onIndexChange])

  const show = (position: number) => {
    const slide = track.current?.children[position] as HTMLElement | undefined
    track.current?.scrollTo({ left: slide?.offsetLeft ?? 0 })
    setActive(position)
    onIndexChange(position)
  }

  return (
    <div data-testid="gallery-main" className={cn(galleryMainClass, 'bg-transparent', className)}>
      <div
        ref={track}
        // Focusable so the keyboard can scroll it (arrow keys), as axe's scrollable-region rule asks.
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a scroll container must be reachable
        tabIndex={0}
        role="region"
        aria-label="Imagens do NFT"
        className="flex size-full snap-x snap-mandatory [scrollbar-width:none] overflow-x-auto overscroll-x-contain rounded-card-mobile"
      >
        {images.map((image, position) => (
          <div
            key={image.url}
            role="group"
            aria-roledescription="slide"
            aria-label={`Imagem ${String(position + 1)} de ${String(images.length)}`}
            className="size-full shrink-0 snap-center"
          >
            <NftImage
              image={image}
              slot="gallery"
              priority={position === 0}
              className="size-full object-cover"
            />
          </div>
        ))}
      </div>
      {zoom}
      {images.length > 1 && (
        <div className="absolute inset-x-0 bottom-18 flex justify-center">
          {images.map((image, position) => (
            <button
              key={image.url}
              type="button"
              aria-label={`Ver imagem ${String(position + 1)} de ${String(images.length)}`}
              aria-current={position === active ? 'true' : undefined}
              onClick={() => {
                show(position)
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
      )}
    </div>
  )
}
