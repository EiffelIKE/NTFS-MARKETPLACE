import { describe, expect, it } from 'vitest'

import { AVATAR_MAX_BYTES, AVATAR_SIZE_MESSAGE, AVATAR_TYPE_MESSAGE } from '@/contracts'

import { checkAvatarFile } from './avatar-file'

describe('checkAvatarFile (ACC-07)', () => {
  it('accepts PNG, JPEG and WebP up to 2 MB', () => {
    expect(checkAvatarFile({ type: 'image/png', size: AVATAR_MAX_BYTES })).toBeNull()
    expect(checkAvatarFile({ type: 'image/jpeg', size: 1 })).toBeNull()
    expect(checkAvatarFile({ type: 'image/webp', size: 1024 })).toBeNull()
  })

  it('rejects other types', () => {
    expect(checkAvatarFile({ type: 'image/gif', size: 1024 })).toBe(AVATAR_TYPE_MESSAGE)
    expect(checkAvatarFile({ type: '', size: 1024 })).toBe(AVATAR_TYPE_MESSAGE)
  })

  it('rejects one byte over 2 MB', () => {
    expect(checkAvatarFile({ type: 'image/png', size: AVATAR_MAX_BYTES + 1 })).toBe(
      AVATAR_SIZE_MESSAGE,
    )
  })

  it('checks the type before the size, as the API does', () => {
    expect(checkAvatarFile({ type: 'image/gif', size: AVATAR_MAX_BYTES + 1 })).toBe(
      AVATAR_TYPE_MESSAGE,
    )
  })
})
