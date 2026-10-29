import * as React from 'react'

import { notify } from '@/components/feedback'
import { EmptyImageIcon, SpinnerIcon } from '@/components/icons'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { FieldError } from '@/components/ui/field'
import { AVATAR_SIZE_MESSAGE, AVATAR_TYPE_MESSAGE, type Profile } from '@/contracts'
import { ApiError } from '@/lib/http/errors'

import { useRemoveAvatar, useUploadAvatar } from '../api/profile-mutations'
import { AVATAR_ACCEPT, checkAvatarFile } from '../model/avatar-file'

/** The message under the avatar for a failed upload: the API's codes get the client's wording. */
function uploadMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'PAYLOAD_TOO_LARGE' || error.status === 413) return AVATAR_SIZE_MESSAGE
    if (error.code === 'UNSUPPORTED_MEDIA_TYPE' || error.status === 415) return AVATAR_TYPE_MESSAGE
    return error.message
  }
  return 'Não foi possível enviar a imagem. Tente novamente.'
}

/**
 * Avatar upload and removal (ACC-07 – ACC-09). Both act at once, not on "Salvar", and the header
 * follows through the session user. While a file uploads its local preview shows with a spinner;
 * a failure brings the previous avatar back and puts the reason under the field.
 */
export function AvatarField({ profile }: { profile: Profile }) {
  const labelId = React.useId()
  const errorId = React.useId()
  const input = React.useRef<HTMLInputElement>(null)
  const change = React.useRef<HTMLButtonElement>(null)
  const preview = React.useRef<string | null>(null)
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const upload = useUploadAvatar()
  const remove = useRemoveAvatar()
  const busy = upload.isPending || remove.isPending
  const refocus = React.useRef(false)
  React.useEffect(() => {
    if (busy || !refocus.current) return
    refocus.current = false
    change.current?.focus()
  }, [busy])

  const dropPreview = () => {
    if (preview.current) URL.revokeObjectURL(preview.current)
    preview.current = null
    setPreviewUrl(null)
  }
  // An object URL outlives the component unless it is revoked.
  React.useEffect(
    () => () => {
      if (preview.current) URL.revokeObjectURL(preview.current)
    },
    [],
  )

  const onFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    // Clearing the input lets the same file be chosen again after a failure.
    event.target.value = ''
    if (!file) return
    const invalid = checkAvatarFile(file)
    if (invalid) {
      setError(invalid)
      return
    }
    setError(null)
    preview.current = URL.createObjectURL(file)
    setPreviewUrl(preview.current)
    upload.mutate(file, {
      onSuccess: () => {
        notify.success('Foto atualizada.')
      },
      onError: (failure) => {
        setError(uploadMessage(failure))
      },
      onSettled: dropPreview,
    })
  }

  const onRemove = () => {
    setError(null)
    remove.mutate(undefined, {
      onSuccess: () => {
        notify.success('Foto removida.')
        // The button that had focus is disabled now; focus moves once the request has settled.
        refocus.current = true
      },
      onError: (failure) => {
        setError(uploadMessage(failure))
      },
    })
  }

  const src = previewUrl ?? profile.avatarUrl
  return (
    <div
      role="group"
      aria-labelledby={labelId}
      aria-busy={busy || undefined}
      className="flex flex-col gap-2"
    >
      <span id={labelId} className="text-body-md font-normal text-foreground">
        Avatar
      </span>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 lg:gap-x-6">
        <Avatar className="relative size-12.5 border border-border bg-surface-card">
          {src && <AvatarImage key={src} src={src} alt="Foto de perfil" />}
          <AvatarFallback>
            <EmptyImageIcon className="size-5.5 text-text-accent" />
          </AvatarFallback>
          {upload.isPending && (
            <span className="absolute inset-0 flex items-center justify-center bg-scrim">
              <SpinnerIcon className="size-5 text-foreground" />
            </span>
          )}
        </Avatar>
        <input ref={input} type="file" accept={AVATAR_ACCEPT} hidden onChange={onFile} />
        <Button
          ref={change}
          type="button"
          className="lg:px-5 lg:text-body"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          Alterar
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="lg:px-0 lg:text-body lg:font-normal"
          disabled={busy || profile.avatarUrl === null}
          onClick={onRemove}
        >
          Remover
        </Button>
      </div>
      <p className="text-caption-sm text-text-secondary">A foto é atualizada imediatamente.</p>
      {error && (
        <FieldError id={errorId} role="alert">
          {error}
        </FieldError>
      )}
    </div>
  )
}
