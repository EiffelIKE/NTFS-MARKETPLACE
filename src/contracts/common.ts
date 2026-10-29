import { z } from 'zod'

// Shared primitives of the REST contract (spec 02 §4). This module imports only `zod`.

/** ETH amount as a decimal string: non-negative, no exponent, at most 18 fractional digits. */
export const Eth = z.string().regex(/^(0|[1-9]\d*)(\.\d{1,18})?$/, 'Valor em ETH inválido.')
export type Eth = z.infer<typeof Eth>

/** Quantities are integers, never decimals. */
export const Quantity = z
  .int({ error: 'Informe um número inteiro.' })
  .min(1, 'Quantidade mínima é 1.')
  .max(99, 'Quantidade máxima é 99.')
export type Quantity = z.infer<typeof Quantity>

export const IsoDateTime = z.iso.datetime({ offset: true })
export type IsoDateTime = z.infer<typeof IsoDateTime>

export const NftId = z.string().regex(/^[a-z0-9-]{3,64}$/)
export type NftId = z.infer<typeof NftId>

export const NetworkId = z.enum(['ethereum', 'polygon', 'solana'], {
  error: 'Selecione uma rede.',
})
export type NetworkId = z.infer<typeof NetworkId>

export const Image = z.object({
  /** Smallest variant, the `<img src>` fallback. */
  url: z.string(),
  /** Every variant, for `srcset` with `w` descriptors. */
  srcSet: z.array(z.object({ url: z.string(), width: z.int() })).min(1),
  alt: z.string(),
  /** Intrinsic size of the largest variant, so the box is reserved before the image loads. */
  width: z.int(),
  height: z.int(),
})
export type Image = z.infer<typeof Image>

export const Page = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    page: z.int().min(1),
    pageSize: z.int(),
    totalItems: z.int(),
    totalPages: z.int(),
  })

/** Address shapes shared by wallets and the checkout form. */
export const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/
export const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
export const ENS_NAME = /^[a-z0-9-]+(\.[a-z0-9-]+)*\.eth$/i

export const INVALID_ADDRESS = 'Endereço de carteira inválido.'

/** Required text with a trimmed length range; messages are pt-BR and shared with the forms. */
export function text(min: number, max: number, requiredMessage = 'Campo obrigatório.') {
  return z
    .string({ error: requiredMessage })
    .trim()
    .min(1, requiredMessage)
    .min(min, `Use pelo menos ${String(min)} caracteres.`)
    .max(max, `Use no máximo ${String(max)} caracteres.`)
}

export const Email = z
  .string({ error: 'Informe seu e-mail.' })
  .trim()
  .min(1, 'Informe seu e-mail.')
  .max(120, 'Use no máximo 120 caracteres.')
  .pipe(z.email('E-mail inválido.'))

export const Username = z
  .string({ error: 'Informe um nome de usuário.' })
  .min(1, 'Informe um nome de usuário.')
  .min(3, 'Use pelo menos 3 caracteres.')
  .max(20, 'Use no máximo 20 caracteres.')
  .regex(/^[a-z0-9_]+$/, 'Use apenas letras minúsculas, números e _.')

export const ReferralCode = z
  .string({ error: 'Campo obrigatório.' })
  .min(1, 'Campo obrigatório.')
  .regex(/^[A-Z0-9-]{4,16}$/, 'Use de 4 a 16 letras maiúsculas, números ou hífen.')

export const EnsLabel = z
  .string({ error: 'Campo obrigatório.' })
  .trim()
  .min(1, 'Campo obrigatório.')
  .regex(/^[a-z0-9-]{3,40}$/, 'Use de 3 a 40 letras minúsculas, números ou hífen.')
