import * as React from 'react'

import { ArrowLeftIcon, ChevronRightIcon, SearchIcon } from '@/components/icons'
import { NftImage } from '@/components/nft-image'
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import type { Image } from '@/contracts'
import { cn } from '@/lib/utils'

import { useSlideTrack } from '../hooks/use-slide-track'
import { slideLabel, stepSlide } from '../model/slides'
import { SlideDots, SlideTrack } from './slide-track'

/**
 * The zoom button and its dialog (DET-05): a viewer over every image of the NFT, opened on the
 * one the page shows, at the largest size we have. It slides (swipe, buttons, arrow keys, dots);
 * on close the page's gallery moves to the image the viewer ended on (`onIndexChange`). Radix
 * traps focus, closes on `Esc` and returns focus to the button.
 */
export function ZoomDialog({
  name,
  images,
  index,
  onIndexChange,
  className,
}: {
  name: string
  images: readonly Image[]
  index: number
  onIndexChange: (index: number) => void
  className?: string
}) {
  const [shown, setShown] = React.useState(index)

  return (
    <Dialog
      onOpenChange={(open) => {
        // Open on the page's image; hand the viewer's image back when it closes.
        if (open) setShown(index)
        else onIndexChange(shown)
      }}
    >
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
        <ZoomViewer name={name} images={images} index={index} onShow={setShown} />
      </DialogContent>
    </Dialog>
  )
}

const stepButtonClass =
  'absolute top-1/2 flex size-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-ink/80 text-foreground hover:text-text-accent disabled:pointer-events-none disabled:opacity-30 [&_svg]:h-3.5 [&_svg]:w-2'

/** What the dialog shows once open: the title, the slider, the step buttons and the dots. */
function ZoomViewer({
  name,
  images,
  index,
  onShow,
}: {
  name: string
  images: readonly Image[]
  index: number
  onShow: (index: number) => void
}) {
  const total = images.length
  const many = total > 1
  const { track, active, show } = useSlideTrack({
    count: total,
    index,
    smooth: true,
    onChange: onShow,
  })
  const previous = stepSlide(active, -1, total)
  const next = stepSlide(active, 1, total)

  // The dialog is modal, so the keys are the viewer's wherever the focus is inside it. The track
  // is focusable and scrolls on the arrows by itself, hence `preventDefault`.
  React.useEffect(() => {
    if (!many) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      event.preventDefault()
      const target = stepSlide(active, event.key === 'ArrowLeft' ? -1 : 1, total)
      if (target !== null) show(target)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [active, many, show, total])

  return (
    <>
      <DialogTitle className="pr-10 text-body-lg">
        {name} — imagem {active + 1} de {total}
      </DialogTitle>
      {many && <SpokenSlide text={slideLabel(active, total)} />}
      <div className="relative">
        <SlideTrack images={images} track={track} className="rounded-artwork">
          {(image, position) => (
            <NftImage
              image={image}
              slot="zoom"
              priority={position === index}
              className={cn(
                'mx-auto w-auto max-w-full rounded-artwork object-contain',
                many ? 'max-h-[calc(100dvh-188px)]' : 'max-h-[calc(100dvh-140px)]',
              )}
            />
          )}
        </SlideTrack>
        {many && (
          <>
            <button
              type="button"
              aria-label="Imagem anterior"
              disabled={previous === null}
              onClick={() => {
                if (previous !== null) show(previous)
              }}
              className={cn(stepButtonClass, 'left-2')}
            >
              <ArrowLeftIcon />
            </button>
            <button
              type="button"
              aria-label="Próxima imagem"
              disabled={next === null}
              onClick={() => {
                if (next !== null) show(next)
              }}
              className={cn(stepButtonClass, 'right-2')}
            >
              <ChevronRightIcon />
            </button>
          </>
        )}
      </div>
      {many && <SlideDots count={total} active={active} onSelect={show} />}
    </>
  )
}

/** The slide for screen readers: polite, and only once the viewer has settled (no chatter mid-glide). */
function SpokenSlide({ text }: { text: string }) {
  const [spoken, setSpoken] = React.useState(text)
  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setSpoken(text)
    }, 400)
    return () => {
      window.clearTimeout(timer)
    }
  }, [text])
  return (
    <p role="status" className="sr-only">
      {spoken}
    </p>
  )
}
