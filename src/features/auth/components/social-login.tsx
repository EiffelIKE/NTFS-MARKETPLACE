import { FacebookMarkIcon, GoogleMarkIcon } from '@/components/icons'
import { Unavailable } from '@/components/layout/unavailable'
import { Separator } from '@/components/ui/separator'

const social =
  'flex h-10 w-full items-center justify-center gap-3 rounded-sm border border-border bg-transparent text-caption text-text-secondary max-lg:h-10 hover:bg-surface-dark'

/**
 * "Ou continue com" and the two social buttons (AUTH-20). They keep their Figma look but are
 * unavailable actions: tooltip and toast "Disponível em breve", no request, no navigation.
 */
export function SocialLoginButtons() {
  return (
    <div className="flex flex-col gap-3">
      <div className="relative my-1 flex h-5 items-center justify-center lg:-mx-20 lg:mt-2 lg:mb-0 lg:h-4">
        <Separator className="absolute inset-x-0 top-1/2" />
        <p className="relative bg-surface-card px-2 text-caption-sm text-foreground max-lg:bg-background">
          Ou continue com
        </p>
      </div>
      <Unavailable as="button" className={social}>
        <GoogleMarkIcon className="size-5" />
        Continuar com Google
      </Unavailable>
      <Unavailable as="button" className={social}>
        <FacebookMarkIcon className="size-5" />
        Continuar com Facebook
      </Unavailable>
    </div>
  )
}
