import { z } from 'zod'

import { NftId } from './common'

export const FavoriteIds = z.object({ nftIds: z.array(NftId) })
export type FavoriteIds = z.infer<typeof FavoriteIds>
