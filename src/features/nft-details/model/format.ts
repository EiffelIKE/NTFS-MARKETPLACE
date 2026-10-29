/** `0x7A42…19E8` style: enough of both ends to recognize an address. */
export function shortAddress(address: string): string {
  return address.length > 12 ? `${address.slice(0, 6)}...${address.slice(-4)}` : address
}

const reviewDate = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeZone: 'UTC' })

/** "10 de set. de 2026", in UTC so the text does not depend on the reader's time zone. */
export const formatReviewDate = (iso: string): string => reviewDate.format(new Date(iso))

/** "4.8", one decimal as drawn in Figma. */
export const ratingValue = (rating: number): string => rating.toFixed(1)

/** "19 avaliações de colecionadores", with the singular and the empty case. */
export function reviewCountLabel(count: number): string {
  if (count === 0) return 'Ainda sem avaliações'
  return `${String(count)} ${count === 1 ? 'avaliação' : 'avaliações'} de colecionadores`
}
