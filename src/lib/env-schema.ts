import { z } from 'zod'

// Pure schema module: imported by both the app (`env.ts`) and `vite.config.ts`, so it must not
// touch `import.meta.env`.

const positiveInt = z.coerce
  .number({ error: 'expected positive integer' })
  .int({ error: 'expected positive integer' })
  .positive({ error: 'expected positive integer' })

export const envSchema = z.object({
  VITE_API_BASE_URL: z.string().min(1, { error: 'expected non-empty string' }).default('/api'),
  VITE_API_TIMEOUT_MS: positiveInt.default(10_000),
  // Spelled out on purpose: a typo such as `1` fails fast instead of silently disabling mocks.
  VITE_ENABLE_MOCKS: z
    .enum(['true', 'false'], { error: 'expected "true" or "false"' })
    .default('true')
    .transform((value) => value === 'true'),
})

export type Env = z.infer<typeof envSchema>

export function parseEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw)
  if (result.success) return result.data
  const issues = result.error.issues
    .map((issue) => `${issue.path.join('.')} — ${issue.message}`)
    .join('; ')
  throw new Error(`Invalid environment: ${issues}`)
}
