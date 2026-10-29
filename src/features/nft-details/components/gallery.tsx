import * as React from 'react'

import { NftImage } from '@/components/nft-image'
import type { NftDetail } from '@/contracts'
import { useMediaQuery } from '@/hooks/use-media-query'
import { cn } from '@/lib/utils'

import { useSlideTrack } from '../hooks/use-slide-track'
import { SlideDots, SlideTrack } from './slide-track'
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
      images={images}
      index={current}
      onIndexChange={setIndex}
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
  return (
    <MobileTrack
      images={images}
      index={current}
      onIndexChange={setIndex}
      zoom={zoom}
      className={className}
    />
  )
}

function MobileTrack({
  images,
  index,
  onIndexChange,
  zoom,
  className,
}: {
  images: NftDetail['images']
  index: number
  onIndexChange: (index: number) => void
  zoom: React.ReactNode
  className?: string | undefined
}) {
  // `index` is also where the zoom dialog left off: the track scrolls there when it closes.
  const { track, active, show } = useSlideTrack({
    count: images.length,
    index,
    onChange: onIndexChange,
  })

  return (
    <div data-testid="gallery-main" className={cn(galleryMainClass, 'bg-transparent', className)}>
      <SlideTrack
        images={images}
        track={track}
        className="size-full rounded-card-mobile"
        slideClassName="size-full"
      >
        {(image, position) => (
          <NftImage
            image={image}
            slot="gallery"
            priority={position === 0}
            className="size-full object-cover"
          />
        )}
      </SlideTrack>
      {zoom}
      {images.length > 1 && (
        <SlideDots
          count={images.length}
          active={active}
          onSelect={show}
          className="absolute inset-x-0 bottom-18"
        />
      )}
    </div>
  )
}
