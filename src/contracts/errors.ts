import { z } from 'zod'

import { NetworkId, NftId } from './common'
import { Quote } from './quote'

/** Codes the server can send; the union is closed (spec 02 §4). */
export const WireErrorCode = z.enum([
  'VALIDATION_FAILED',
  'COUPON_INVALID',
  'COUPON_EXPIRED',
  'COUPON_NOT_APPLICABLE',
  'UNAUTHENTICATED',
  'SESSION_EXPIRED',
  'INVALID_CREDENTIALS',
  'FORBIDDEN',
  'NOT_FOUND',
  'INSUFFICIENT_AVAILABILITY',
  'EDITION_UNAVAILABLE',
  'QUOTE_CHANGED',
  'IDEMPOTENCY_CONFLICT',
  'ORDER_PENDING',
  'EMAIL_TAKEN',
  'USERNAME_TAKEN',
  'WALLET_DUPLICATE',
  'WALLET_ROLE_TAKEN',
  'WALLET_REJECTED',
  'WALLET_NOT_CONNECTED',
  'PAYLOAD_TOO_LARGE',
  'UNSUPPORTED_MEDIA_TYPE',
  'RATE_LIMITED',
  'INTERNAL',
  'SERVICE_UNAVAILABLE',
])
export type WireErrorCode = z.infer<typeof WireErrorCode>

/** `UNKNOWN` exists only on the client: a missing or malformed error body (API-12). */
export type ApiErrorCode = WireErrorCode | 'UNKNOWN'

/** Default pt-BR message and HTTP status per code. */
export const ERROR_DEFAULTS: Record<WireErrorCode, { status: number; message: string }> = {
  VALIDATION_FAILED: { status: 422, message: 'Alguns campos precisam de atenção.' },
  COUPON_INVALID: { status: 422, message: 'Cupom inválido.' },
  COUPON_EXPIRED: { status: 422, message: 'Este cupom expirou.' },
  COUPON_NOT_APPLICABLE: { status: 422, message: 'Este cupom não se aplica ao seu carrinho.' },
  UNAUTHENTICATED: { status: 401, message: 'Entre na sua conta para continuar.' },
  SESSION_EXPIRED: { status: 401, message: 'Sua sessão expirou. Entre novamente.' },
  INVALID_CREDENTIALS: { status: 401, message: 'E-mail ou senha incorretos.' },
  FORBIDDEN: { status: 403, message: 'Você não tem permissão para acessar este recurso.' },
  NOT_FOUND: { status: 404, message: 'Recurso não encontrado.' },
  INSUFFICIENT_AVAILABILITY: {
    status: 409,
    message: 'A quantidade pedida não está mais disponível.',
  },
  EDITION_UNAVAILABLE: { status: 409, message: 'Esta edição está esgotada.' },
  QUOTE_CHANGED: {
    status: 409,
    message: 'Os valores do seu pedido mudaram. Revise e confirme novamente.',
  },
  IDEMPOTENCY_CONFLICT: {
    status: 409,
    message: 'Esta tentativa já foi usada com outro conteúdo.',
  },
  ORDER_PENDING: { status: 409, message: 'Você já tem um pedido aguardando confirmação.' },
  EMAIL_TAKEN: { status: 409, message: 'Este e-mail já está cadastrado.' },
  USERNAME_TAKEN: { status: 409, message: 'Este nome de usuário já está em uso.' },
  WALLET_DUPLICATE: { status: 409, message: 'Este endereço já está em outra carteira sua.' },
  WALLET_ROLE_TAKEN: { status: 409, message: 'Você já tem uma carteira neste papel.' },
  WALLET_REJECTED: { status: 409, message: 'A carteira recusou a conexão.' },
  WALLET_NOT_CONNECTED: { status: 409, message: 'Conecte a carteira para continuar.' },
  PAYLOAD_TOO_LARGE: { status: 413, message: 'O arquivo é grande demais.' },
  UNSUPPORTED_MEDIA_TYPE: { status: 415, message: 'Formato de arquivo não suportado.' },
  RATE_LIMITED: { status: 429, message: 'Muitas tentativas. Aguarde um momento.' },
  INTERNAL: { status: 500, message: 'Algo deu errado do nosso lado. Tente novamente.' },
  SERVICE_UNAVAILABLE: { status: 503, message: 'Serviço temporariamente indisponível.' },
}

/** `details` shape per code; codes not listed here carry no details. */
export const errorDetailSchemas = {
  NOT_FOUND: z.object({ resource: z.string() }),
  INSUFFICIENT_AVAILABILITY: z.object({
    lines: z.array(
      z.object({
        nftId: NftId,
        editionId: z.string(),
        requested: z.int(),
        available: z.int(),
      }),
    ),
  }),
  EDITION_UNAVAILABLE: z.object({ nftId: NftId, editionId: z.string() }),
  QUOTE_CHANGED: z.object({ quote: Quote }),
  IDEMPOTENCY_CONFLICT: z.object({ orderId: z.string() }),
  ORDER_PENDING: z.object({ orderId: z.string() }),
  WALLET_REJECTED: z.object({ walletId: z.string(), network: NetworkId }),
  WALLET_NOT_CONNECTED: z.object({ walletId: z.string(), network: NetworkId }),
  PAYLOAD_TOO_LARGE: z.object({ maxBytes: z.int() }),
  UNSUPPORTED_MEDIA_TYPE: z.object({ accepted: z.array(z.string()) }),
  RATE_LIMITED: z.object({ retryAfterMs: z.int() }),
} as const satisfies Partial<Record<WireErrorCode, z.ZodType>>

type DetailSchemas = typeof errorDetailSchemas

export type DetailsOf<C extends ApiErrorCode> = C extends keyof DetailSchemas
  ? z.infer<DetailSchemas[C]>
  : undefined

/** The details schema for a code, or `undefined` when the code carries none. */
export function errorDetails(code: ApiErrorCode): z.ZodType | undefined {
  return code in errorDetailSchemas ? errorDetailSchemas[code as keyof DetailSchemas] : undefined
}

export const ErrorEnvelope = z.object({
  error: z.object({
    code: WireErrorCode,
    /** pt-BR, safe to show. */
    message: z.string(),
    /** Key is the dotted field path (`collector.email`). */
    fields: z.record(z.string(), z.array(z.string())).optional(),
    details: z.unknown().optional(),
  }),
})
export type ErrorEnvelope = z.infer<typeof ErrorEnvelope>
