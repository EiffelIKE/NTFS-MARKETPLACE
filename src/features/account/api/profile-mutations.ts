import {
  useMutation,
  useQueryClient,
  type MutationOptions,
  type QueryClient,
} from '@tanstack/react-query'

import { profileApi } from '@/api'
import type { ChangePasswordBody, Profile, UpdateProfileBody } from '@/contracts'
import { session as appSession } from '@/features/auth/model/instance'
import type { SessionController } from '@/features/auth/model/session'
import type { ApiError } from '@/lib/http/errors'

import { accountKeys } from './account-keys'

type Guard = Pick<SessionController, 'epoch' | 'isCurrent' | 'get' | 'updateUser'>

interface WriteContext {
  epoch: number
  userId: string | null
}

/** The session user the header shows, from a saved profile. */
const sessionPatch = ({ displayName, username, email, avatarUrl }: Profile) => ({
  displayName,
  username,
  email,
  avatarUrl,
})

/**
 * Every profile write answers with the whole `Profile`: it replaces the cached one and patches the
 * session user, so the header name and avatar follow without a reload (ACC-06, ACC-09). A result
 * that arrives after the session changed (sign-out, user switch) belongs to nobody and is dropped
 * (spec 04 epoch guard). Options factories, so the logic runs under a plain `MutationObserver`.
 */
function profileWriteOptions<TVariables>(
  queryClient: QueryClient,
  key: string,
  mutationFn: (variables: TVariables) => Promise<Profile>,
  session: Guard,
): MutationOptions<Profile, ApiError, TVariables, WriteContext> {
  return {
    mutationKey: ['account', 'profile', key],
    mutationFn,
    onMutate: () => {
      const state = session.get()
      return {
        epoch: session.epoch(),
        userId: state.status === 'authenticated' ? state.user.id : null,
      }
    },
    onSuccess: async (profile, _variables, context) => {
      if (context.userId === null || !session.isCurrent(context.epoch)) return
      // A profile read that started before the write must not land on top of it.
      await queryClient.cancelQueries({
        queryKey: accountKeys.profile(context.userId),
        exact: true,
      })
      queryClient.setQueryData(accountKeys.profile(context.userId), profile)
      session.updateUser(sessionPatch(profile))
    },
  }
}

/** `profile.update`: a full replace of the Figma fields (ACC-04). */
export function updateProfileOptions(queryClient: QueryClient, session: Guard = appSession) {
  return profileWriteOptions(
    queryClient,
    'update',
    (body: UpdateProfileBody) => profileApi.update(body),
    session,
  )
}

/** `profile.uploadAvatar` (ACC-07). */
export function uploadAvatarOptions(queryClient: QueryClient, session: Guard = appSession) {
  return profileWriteOptions(
    queryClient,
    'upload-avatar',
    (file: File) => profileApi.uploadAvatar(file),
    session,
  )
}

/** `profile.removeAvatar` (ACC-09). */
export function removeAvatarOptions(queryClient: QueryClient, session: Guard = appSession) {
  return profileWriteOptions(queryClient, 'remove-avatar', () => profileApi.removeAvatar(), session)
}

export function useUpdateProfile() {
  const queryClient = useQueryClient()
  return useMutation(updateProfileOptions(queryClient))
}

export function useUploadAvatar() {
  const queryClient = useQueryClient()
  return useMutation(uploadAvatarOptions(queryClient))
}

export function useRemoveAvatar() {
  const queryClient = useQueryClient()
  return useMutation(removeAvatarOptions(queryClient))
}

/**
 * `profile.changePassword` (ACC-11, ACC-12). It touches no cache: the session stays, and the
 * password is not kept anywhere once the request has gone out.
 */
export function useChangePassword() {
  return useMutation<undefined, ApiError, ChangePasswordBody>({
    mutationKey: ['account', 'profile', 'password'],
    mutationFn: (body) => profileApi.changePassword(body),
  })
}
