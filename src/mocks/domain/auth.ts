import type { SessionInfo, SessionPayload, SignupBody, UpdateProfileBody } from '@/contracts'

import type { MockState, SessionRecord, Token, UserRecord } from '../db/state'
import type { Tx } from '../db/store'
import { HttpError } from '../lib/http-error'
import { newToken } from '../lib/crypto'
import { toUser } from './mappers'

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function findUserByEmail(state: Readonly<MockState>, email: string): UserRecord | undefined {
  const wanted = normalizeEmail(email)
  return Object.values(state.users).find((user) => user.email === wanted)
}

export type SessionLookup =
  | { kind: 'ok'; token: Token; session: SessionRecord; user: UserRecord }
  | { kind: 'expired' }
  | { kind: 'unknown' }

/** Resolves a bearer token against the persisted sessions (spec 02 §8.1 step 4). */
export function lookupSession(
  state: Readonly<MockState>,
  token: Token,
  now: number,
): SessionLookup {
  const session = state.sessions[token]
  if (!session) return { kind: 'unknown' }
  if (session.expiresAt <= now) return { kind: 'expired' }
  const user = state.users[session.userId]
  return user ? { kind: 'ok', token, session, user } : { kind: 'unknown' }
}

/** Creates the opaque bearer token and its fixed expiry (no sliding). */
export function openSession(tx: Tx, user: UserRecord, ttlMs: number): SessionPayload {
  const token = newToken()
  const expiresAt = tx.now + ttlMs
  tx.state.sessions[token] = { userId: user.id, createdAt: tx.now, expiresAt }
  return { token, expiresAt: new Date(expiresAt).toISOString(), user: toUser(user) }
}

export function sessionInfo(session: SessionRecord, user: UserRecord): SessionInfo {
  return { expiresAt: new Date(session.expiresAt).toISOString(), user: toUser(user) }
}

export function closeSession(tx: Tx, token: Token): void {
  Reflect.deleteProperty(tx.state.sessions, token)
}

/** Drops sessions of a user, optionally keeping one (password change keeps the current one). */
export function revokeSessions(tx: Tx, userId: string, except?: Token): void {
  for (const [token, session] of Object.entries(tx.state.sessions)) {
    if (session.userId === userId && token !== except)
      Reflect.deleteProperty(tx.state.sessions, token)
  }
}

function assertUnique(
  state: Readonly<MockState>,
  fields: { email?: string; username?: string },
  exceptUserId?: string,
): void {
  const others = Object.values(state.users).filter((user) => user.id !== exceptUserId)
  if (fields.email !== undefined) {
    const wanted = normalizeEmail(fields.email)
    if (others.some((user) => user.email === wanted)) {
      throw new HttpError('EMAIL_TAKEN', { fields: { email: ['Este e-mail já está cadastrado.'] } })
    }
  }
  if (fields.username !== undefined && others.some((user) => user.username === fields.username)) {
    throw new HttpError('USERNAME_TAKEN', {
      fields: { username: ['Este nome de usuário já está em uso.'] },
    })
  }
}

/** The password arrives already hashed: hashing is async and transactions are synchronous. */
export function signup(tx: Tx, body: SignupBody, passwordHash: string): UserRecord {
  assertUnique(tx.state, { email: body.email, username: body.username })
  const id = `usr_${String(++tx.state.seq.user).padStart(6, '0')}`
  const user: UserRecord = {
    id,
    username: body.username,
    displayName: body.username,
    email: normalizeEmail(body.email),
    avatarUrl: null,
    ensName: null,
    walletNickname: null,
    createdAt: new Date(tx.now).toISOString(),
    passwordHash,
  }
  tx.state.users[id] = user
  return user
}

export function updateProfile(tx: Tx, userId: string, body: UpdateProfileBody): UserRecord {
  const user = tx.state.users[userId]
  if (!user) throw new HttpError('UNAUTHENTICATED')
  assertUnique(tx.state, { email: body.email, username: body.username }, userId)
  user.displayName = body.displayName
  user.username = body.username
  user.email = normalizeEmail(body.email)
  user.ensName = body.ensName
  user.walletNickname = body.walletNickname
  return user
}
