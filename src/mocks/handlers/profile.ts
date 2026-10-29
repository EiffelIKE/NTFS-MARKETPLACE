import {
  AVATAR_ACCEPTED_TYPES,
  AVATAR_MAX_BYTES,
  ChangePasswordBody,
  UpdateProfileBody,
  type OperationId,
} from '@/contracts'

import { revokeSessions, updateProfile } from '../domain/auth'
import { toProfile } from '../domain/mappers'
import { hashPassword, verifyPassword } from '../lib/crypto'
import { HttpError, fieldError } from '../lib/http-error'
import { noContent, ok, op, type AnyOp } from './pipeline'

const MAGIC: Record<(typeof AVATAR_ACCEPTED_TYPES)[number], (bytes: Uint8Array) => boolean> = {
  'image/png': (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/webp': (b) =>
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45,
}

const isAcceptedType = (type: string): type is (typeof AVATAR_ACCEPTED_TYPES)[number] =>
  (AVATAR_ACCEPTED_TYPES as readonly string[]).includes(type)

const unsupported = () =>
  new HttpError('UNSUPPORTED_MEDIA_TYPE', { details: { accepted: [...AVATAR_ACCEPTED_TYPES] } })

export const profileOps = {
  'profile.get': op({
    handle: ({ user }) => ok(toProfile(user())),
  }),

  'profile.update': op({
    body: UpdateProfileBody,
    handle({ runtime, body, user }) {
      const { id } = user()
      return ok(toProfile(runtime.store.write((tx) => updateProfile(tx, id, body))))
    },
  }),

  'profile.uploadAvatar': op({
    async handle({ runtime, request, user }) {
      const { id } = user()
      let file: FormDataEntryValue | null = null
      try {
        file = (await request.formData()).get('file')
      } catch {
        throw fieldError('file', 'Envie o arquivo da imagem.')
      }
      if (!(file instanceof Blob)) throw fieldError('file', 'Envie o arquivo da imagem.')
      if (!isAcceptedType(file.type)) throw unsupported()
      const bytes = new Uint8Array(await file.arrayBuffer())
      if (!MAGIC[file.type](bytes)) throw unsupported()
      if (bytes.length > AVATAR_MAX_BYTES) {
        throw new HttpError('PAYLOAD_TOO_LARGE', { details: { maxBytes: AVATAR_MAX_BYTES } })
      }
      const avatarUrl = await runtime.processAvatar(bytes, file.type)
      return ok(
        toProfile(
          runtime.store.write((tx) => {
            const record = tx.state.users[id]
            if (!record) throw new HttpError('UNAUTHENTICATED')
            record.avatarUrl = avatarUrl
            return record
          }),
        ),
      )
    },
  }),

  'profile.removeAvatar': op({
    handle({ runtime, user }) {
      const { id } = user()
      return ok(
        toProfile(
          runtime.store.write((tx) => {
            const record = tx.state.users[id]
            if (!record) throw new HttpError('UNAUTHENTICATED')
            record.avatarUrl = null
            return record
          }),
        ),
      )
    },
  }),

  'profile.changePassword': op({
    body: ChangePasswordBody,
    async handle({ runtime, body, session, user }) {
      const current = user()
      if (!(await verifyPassword(body.currentPassword, current.passwordHash))) {
        throw fieldError('currentPassword', 'Senha atual incorreta.')
      }
      const passwordHash = await hashPassword(body.newPassword)
      runtime.store.write((tx) => {
        const record = tx.state.users[current.id]
        if (!record) throw new HttpError('UNAUTHENTICATED')
        record.passwordHash = passwordHash
        // Other devices must sign in again; this session stays.
        revokeSessions(tx, current.id, session?.token)
      })
      return noContent()
    },
  }),
} satisfies Partial<Record<OperationId, AnyOp>>
