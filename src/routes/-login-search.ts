import { z } from 'zod'

// Only same-origin absolute paths survive (no `//host` or `https://…`), so there is no open
// redirect. Anything else degrades to `undefined` instead of throwing.
export const loginSearchSchema = z.object({
  redirect: z
    .string()
    .startsWith('/')
    .refine((s) => !s.startsWith('//'))
    .optional()
    .catch(undefined),
})

export type LoginSearch = z.infer<typeof loginSearchSchema>
