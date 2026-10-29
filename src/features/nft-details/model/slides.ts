/** The slide a horizontal track is scrolled to, when every slide is as wide as the track. */
export function slideAt(scrollLeft: number, width: number, count: number): number {
  if (width <= 0 || count < 1) return 0
  return Math.min(count - 1, Math.max(0, Math.round(scrollLeft / width)))
}

/** `index` moved by `delta`, or `null` when that runs past either end (the buttons stop there). */
export function stepSlide(index: number, delta: number, count: number): number | null {
  const next = index + delta
  return next >= 0 && next < count ? next : null
}

/** "Imagem 2 de 4": the name of a slide and the title's tail. */
export const slideLabel = (index: number, count: number): string =>
  `Imagem ${String(index + 1)} de ${String(count)}`
