import { LoadingRegion } from '@/components/loading-region'

import { useProfile } from '../model/use-account'
import { AccountLayout } from './account-layout'
import { LoadError, ProfileSkeleton } from './account-states'
import { ProfileForm } from './profile-form'

/** "Perfil do Colecionador" (spec 08 design §4, §8). */
export function ProfilePage() {
  const profile = useProfile()

  return (
    <AccountLayout current="profile">
      <LoadingRegion loading={profile.isPending} label="Carregando perfil">
        <h1 className="mb-6 text-title font-bold text-foreground lg:mb-9 lg:text-body-lg">
          Perfil do colecionador
        </h1>
        {profile.data ? (
          <ProfileForm profile={profile.data} />
        ) : profile.isError ? (
          <LoadError
            message={profile.error.message}
            onRetry={() => {
              void profile.refetch()
            }}
          />
        ) : (
          <ProfileSkeleton />
        )}
      </LoadingRegion>
    </AccountLayout>
  )
}
