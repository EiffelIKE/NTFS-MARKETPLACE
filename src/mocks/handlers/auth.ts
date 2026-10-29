import { LoginBody, SignupBody, type OperationId } from '@/contracts'

import { closeSession, findUserByEmail, openSession, sessionInfo, signup } from '../domain/auth'
import { hashPassword, verifyPassword } from '../lib/crypto'
import { HttpError } from '../lib/http-error'
import { created, noContent, ok, op, type AnyOp } from './pipeline'

export const authOps = {
  'auth.signup': op({
    body: SignupBody,
    async handle({ runtime, config, body }) {
      const passwordHash = await hashPassword(body.password)
      const payload = runtime.store.write((tx) =>
        openSession(tx, signup(tx, body, passwordHash), config.sessionTtlMs),
      )
      return created(payload)
    },
  }),

  'auth.login': op({
    body: LoginBody,
    async handle({ runtime, config, body }) {
      const user = runtime.store.read((state) => findUserByEmail(state, body.email))
      // Verify even for an unknown email, so the response never reveals which field was wrong.
      const valid = user
        ? await verifyPassword(body.password, user.passwordHash)
        : (await hashPassword(body.password), false)
      if (!user || !valid) throw new HttpError('INVALID_CREDENTIALS')
      return ok(runtime.store.write((tx) => openSession(tx, user, config.sessionTtlMs)))
    },
  }),

  'auth.session': op({
    handle({ runtime, session }) {
      if (!session) throw new HttpError('UNAUTHENTICATED')
      const record = runtime.store.read((state) => state.sessions[session.token])
      if (!record) throw new HttpError('UNAUTHENTICATED')
      return ok(sessionInfo(record, session.user))
    },
  }),

  'auth.logout': op({
    handle({ runtime, session }) {
      if (session) {
        runtime.store.write((tx) => {
          closeSession(tx, session.token)
        })
      }
      return noContent()
    },
  }),
} satisfies Partial<Record<OperationId, AnyOp>>
