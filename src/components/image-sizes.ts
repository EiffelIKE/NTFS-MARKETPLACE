/** `sizes` per slot (spec 05 design §8), so the browser picks the smallest sufficient candidate. */
export const IMAGE_SIZES = {
  hero: '(min-width: 1024px) 450px, 138px',
  grid: '(min-width: 1024px) 250px, (min-width: 768px) 30vw, 168px',
  featured: '310px',
  promo: '290px',
  blog: '268px',
  compact: '(min-width: 1024px) 212px, 40vw',
  // Details gallery (spec 06 design §6): the main image is the LCP, so its candidate must be tight.
  gallery: '(min-width: 1024px) 404px, calc(100vw - 48px)',
  thumb: '100px',
  zoom: 'min(90vw, 1000px)',
} as const

export type ImageSlot = keyof typeof IMAGE_SIZES
