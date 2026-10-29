import { z } from 'zod'

import { SessionInfo, SessionPayload, type LoginBody, type SignupBody } from '@/contracts'

import { request, type ReadOptions } from './request'

export const authApi = {
  signup: (body: SignupBody) =>
    request({
      id: 'auth.signup',
      method: 'POST',
      url: '/auth/signup',
      data: body,
      response: SessionPayload,
    }),
  login: (body: LoginBody) =>
    request({
      id: 'auth.login',
      method: 'POST',
      url: '/auth/login',
      data: body,
      response: SessionPayload,
    }),
  session: (opts: ReadOptions = {}) =>
    request({
      id: 'auth.session',
      method: 'GET',
      url: '/auth/session',
      response: SessionInfo,
      ...opts,
    }),
  logout: () =>
    request({ id: 'auth.logout', method: 'POST', url: '/auth/logout', response: z.undefined() }),
}
