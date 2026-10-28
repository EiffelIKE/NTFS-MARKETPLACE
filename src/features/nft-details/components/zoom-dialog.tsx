import { NftImage } from '@/components/nft-image'
import { SearchIcon } from '@/components/icons'
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import type { Image } from '@/contracts'
import { cn } from '@/lib/utils'

/**
 * The zoom button and its dialog (DET-05): the current image at the largest size we have. Radix
 * traps focus, closes on `Esc` and returns focus to the button.
 */
export function ZoomDialog({
  name,
  image,
  index,
  total,
  className,
}: {
  name: string
  image: Image
  index: number
  total: number
  className?: string
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="Ampliar imagem"
          className={cn(
            'flex size-8 cursor-pointer items-center justify-center rounded-full bg-ink text-foreground hover:text-text-accent [&_svg]:size-4',
            className,
          )}
        >
          <SearchIcon />
        </button>
      </DialogTrigger>
      <DialogContent
        aria-describedby={undefined}
        className="max-w-[min(1040px,calc(100vw-32px))] p-4"
      >
        <DialogTitle className="pr-10 text-body-lg">
          {name} — imagem {index + 1} de {total}
        </DialogTitle>
        <NftImage
          image={image}
          slot="zoom"
          className="mx-auto max-h-[calc(100dvh-140px)] w-auto max-w-full rounded-artwork object-contain"
        />
      </DialogContent>
    </Dialog>
  )
}
