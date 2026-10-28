import { z } from 'zod'

import { Profile, type ChangePasswordBody, type UpdateProfileBody } from '@/contracts'

import { request, type ReadOptions } from './request'

export const profileApi = {
  get: (opts: ReadOptions = {}) =>
    request({ id: 'profile.get', method: 'GET', url: '/profile', response: Profile, ...opts }),
  update: (body: UpdateProfileBody) =>
    request({
      id: 'profile.update',
      method: 'PUT',
      url: '/profile',
      data: body,
      response: Profile,
    }),
  uploadAvatar: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return request({
      id: 'profile.uploadAvatar',
      method: 'PUT',
      url: '/profile/avatar',
      data: form,
      response: Profile,
    })
  },
  removeAvatar: () =>
    request({
      id: 'profile.removeAvatar',
      method: 'DELETE',
      url: '/profile/avatar',
      response: Profile,
    }),
  changePassword: (body: ChangePasswordBody) =>
    request({
      id: 'profile.changePassword',
      method: 'PUT',
      url: '/profile/password',
      data: body,
      response: z.undefined(),
    }),
}
