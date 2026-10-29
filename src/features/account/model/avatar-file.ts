import {
  AVATAR_ACCEPTED_TYPES,
  AVATAR_MAX_BYTES,
  AVATAR_SIZE_MESSAGE,
  AVATAR_TYPE_MESSAGE,
} from '@/contracts'

/** The `accept` of the file picker (ACC-07). */
export const AVATAR_ACCEPT = AVATAR_ACCEPTED_TYPES.join(',')

/**
 * The client side of the avatar check (ACC-07): type first, then size, as the API does. The API
 * stays authoritative (it also reads the file's magic bytes), so this only saves a round trip.
 * Returns the message to show, or `null` when the file may be uploaded.
 */
export function checkAvatarFile(file: Pick<File, 'type' | 'size'>): string | null {
  if (!(AVATAR_ACCEPTED_TYPES as readonly string[]).includes(file.type)) return AVATAR_TYPE_MESSAGE
  if (file.size > AVATAR_MAX_BYTES) return AVATAR_SIZE_MESSAGE
  return null
}
