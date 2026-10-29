import type * as React from 'react'

import type { Image } from '@/contracts'

import { IMAGE_SIZES, type ImageSlot } from './image-sizes'

/**
 * Every NFT image (CAT-23): `srcset` with width descriptors, a per-slot `sizes`, intrinsic size so
 * the box is reserved, and lazy loading unless the image is the page's LCP candidate (`priority`).
 * Pass `alt=""` when a nearby link or heading already names the artwork.
 */
export function NftImage({
  image,
  slot,
  priority = false,
  alt,
  className,
  ...props
}: Omit<React.ComponentProps<'img'>, 'src' | 'srcSet' | 'sizes' | 'width' | 'height'> & {
  image: Image
  slot: ImageSlot
  priority?: boolean
}) {
  return (
    <img
      src={image.url}
      srcSet={image.srcSet
        .map((candidate) => `${candidate.url} ${String(candidate.width)}w`)
        .join(', ')}
      sizes={IMAGE_SIZES[slot]}
      width={image.width}
      height={image.height}
      alt={alt ?? image.alt}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
      className={className}
      {...props}
    />
  )
}
