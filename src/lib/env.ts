import { parseEnv } from './env-schema'

export { envSchema, parseEnv, type Env } from './env-schema'

export const env = parseEnv(import.meta.env)
