import { z } from 'zod'

// Only same-origin absolute paths survive (no `//host` or `https://…`), so there is no open
// redirect. Anything else degrades to `undefined` instead of throwing. Shared by `/login` and
// `/signup` (spec 04 design §6); `reason` says why the user is here.
export const authSearchSchema = z.object({
  redirect: z
    .string()
    .startsWith('/')
    .refine((s) => !s.startsWith('//'))
    .optional()
    .catch(undefined),
  reason: z.literal('expired').optional().catch(undefined),
})

export type AuthSearch = z.infer<typeof authSearchSchema>
