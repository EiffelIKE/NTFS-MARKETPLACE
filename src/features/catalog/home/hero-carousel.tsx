import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import * as React from 'react'

import { AlertCircleIcon, ArrowRightIcon } from '@/components/icons'
import { NftImage } from '@/components/nft-image'
import { Alert, AlertAction, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { Highlights } from '@/contracts'
import { cn } from '@/lib/utils'

import { highlightsQuery } from '../api/queries'
import { HERO_FALLBACK } from '../content/home-copy'

type Slide = Highlights['hero'][number]

// Mobile card 366 × 190, desktop 1200 × 450 (Figma). The desktop height is fixed so nothing shifts;
// on mobile the height is a minimum (spec 11): the copy column of a 390, 380 or 360 px phone is
// narrower than the Figma 414 frame, wraps more lines, and a fixed 190 cut off the eyebrow and the
// "EXPLORAR" link. The loaded card measures 198 px from 385 px up, 216 at 380 and 245 below 376, so
// the minimum is 198 and the skeleton reserves 245 on the narrowest phones, which keeps the
// catalog below it from jumping when the hero loads (CAT-14).
const frame = 'min-h-49.5 lg:h-112.5'

/**
 * The hero (CAT-19, CAT-20): `highlights.hero` as a scroll-snap carousel with one dot button per
 * slide, swipeable, without auto-advance (WCAG 2.2.2). It fails and retries on its own, apart from
 * the catalog and the featured banner.
 */
export function HeroCarousel({ className }: { className?: string | undefined }) {
  const { data, isPending, isError, error, refetch } = useQuery(highlightsQuery())

  if (isPending) {
    return (
      <Skeleton
        className={cn(
          frame,
          'w-full rounded-hero-mobile max-[379px]:min-h-61.25 lg:rounded-none',
          className,
        )}
      />
    )
  }
  if (isError) {
    return (
      <>
        {/* The page keeps its `h1` while the hero, which normally holds it, is unavailable. */}
        <h1 className="sr-only">KURIO</h1>
        <Alert className={className}>
          <AlertCircleIcon />
          <AlertDescription>{error.message}</AlertDescription>
          <AlertAction>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void refetch()
              }}
            >
              Tentar novamente
            </Button>
          </AlertAction>
        </Alert>
      </>
    )
  }
  return <Slides slides={data.hero} className={className} />
}

function Slides({ slides, className }: { slides: Slide[]; className?: string | undefined }) {
  const track = React.useRef<HTMLDivElement>(null)
  const [active, setActive] = React.useState(0)

  // A swipe moves the dots: the slide the track is scrolled to is the active one. The track is as
  // wide as a slide, so the scroll position divided by the width is the index.
  React.useEffect(() => {
    const root = track.current
    if (!root || slides.length < 2) return
    const update = () => {
      setActive(Math.min(slides.length - 1, Math.round(root.scrollLeft / root.clientWidth)))
    }
    root.addEventListener('scroll', update, { passive: true })
    return () => {
      root.removeEventListener('scroll', update)
    }
  }, [slides.length])

  const show = (index: number) => {
    const slide = track.current?.children[index] as HTMLElement | undefined
    // Scroll the track itself, not the page.
    track.current?.scrollTo({ left: slide?.offsetLeft ?? 0 })
    setActive(index)
  }

  return (
    <section
      aria-roledescription="carrossel"
      aria-label="Destaques"
      className={cn(
        'relative flex flex-col overflow-hidden rounded-hero-mobile bg-surface-dark lg:overflow-visible lg:rounded-none lg:bg-transparent',
        frame,
        className,
      )}
    >
      <Circles />
      <div
        ref={track}
        className="relative flex flex-1 snap-x snap-mandatory [scrollbar-width:none] overflow-x-auto overscroll-x-contain lg:overflow-x-hidden"
      >
        {slides.length === 0 ? (
          <div className="w-full shrink-0">
            <SlideContent slide={HERO_FALLBACK} first />
          </div>
        ) : (
          slides.map((slide, index) => (
            <div
              key={slide.id}
              data-index={index}
              aria-roledescription="slide"
              aria-label={`${String(index + 1)} de ${String(slides.length)}`}
              role="group"
              className="w-full shrink-0 snap-center"
            >
              <SlideContent
                slide={slide}
                first={index === 0}
                nextImage={slides[(index + 1) % slides.length]?.image}
              />
            </div>
          ))
        )}
      </div>

      {slides.length > 1 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-1 flex justify-center lg:inset-x-auto lg:bottom-24 lg:left-10 lg:w-150 lg:justify-end">
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              aria-label={`Destaque ${String(index + 1)} de ${String(slides.length)}`}
              aria-current={index === active ? 'true' : undefined}
              onClick={() => {
                show(index)
              }}
              className="pointer-events-auto flex size-6 cursor-pointer items-center justify-center"
            >
              <span
                aria-hidden="true"
                className={cn(
                  'h-1.75 rounded-full bg-primary transition-[width] motion-reduce:transition-none lg:h-2',
                  index === active ? 'w-4 lg:w-5' : 'w-1.75 opacity-50 lg:w-2',
                )}
              />
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

/** Decorative circles of the mobile card (Figma mask `14:5290`), drawn in CSS. */
function Circles() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden lg:hidden"
    >
      <div className="absolute -top-24 -left-10 size-62 rounded-full bg-primary/10" />
      <div className="absolute -right-16 -bottom-28 size-62 rounded-full bg-primary/10" />
    </div>
  )
}

type SlideCopy = Pick<
  Slide,
  'eyebrow' | 'title' | 'shortTitle' | 'description' | 'shortDescription'
>

function SlideContent({
  slide,
  first,
  nextImage,
}: {
  slide: SlideCopy & Partial<Pick<Slide, 'image' | 'nftId'>>
  first: boolean
  nextImage?: Slide['image'] | undefined
}) {
  const Title = first ? 'h1' : 'p'
  const cta =
    'items-center gap-2 text-caption-sm font-bold text-text-accent lg:h-10 lg:w-35 lg:justify-start lg:gap-0 lg:rounded-sm lg:bg-primary lg:pr-9 lg:pl-7 lg:text-body-lg lg:text-ink lg:hover:bg-text-accent'
  const label = (
    <>
      EXPLORAR
      <ArrowRightIcon className="size-4 lg:hidden" />
    </>
  )

  return (
    <div className="relative flex h-full items-center justify-between gap-2 p-4 lg:gap-8 lg:p-0 lg:pl-10">
      <div className="flex min-w-0 flex-1 flex-col lg:max-w-150 lg:flex-initial">
        <p className="text-caption-sm leading-4 font-medium text-foreground lg:text-body lg:tracking-brand">
          {slide.eyebrow}
        </p>
        <Title className="mt-1.5 text-title leading-7.25 text-foreground uppercase lg:mt-2 lg:text-display lg:leading-17.5">
          <span className="lg:hidden">{slide.shortTitle}</span>
          <span className="hidden lg:inline">{slide.title}</span>
        </Title>
        <p className="mt-1.5 text-caption-sm leading-4.5 text-text-secondary lg:mt-1 lg:max-w-139 lg:text-body lg:leading-6">
          <span className="lg:hidden">{slide.shortDescription}</span>
          <span className="hidden lg:inline">{slide.description}</span>
        </p>
        <div className="mt-2 lg:mt-8">
          {slide.nftId ? (
            <Link
              to="/nfts/$nftId"
              params={{ nftId: slide.nftId }}
              className={cn('flex w-fit', cta)}
            >
              {label}
            </Link>
          ) : (
            <Link to="/" hash="mercado" className={cn('flex w-fit', cta)}>
              {label}
            </Link>
          )}
        </div>
      </div>

      {slide.image && (
        <div className="relative shrink-0 lg:min-w-0 lg:shrink">
          <NftImage
            image={slide.image}
            slot="hero"
            priority={first}
            className="size-[clamp(5rem,33vw,8.625rem)] rounded-artwork-mobile object-cover lg:h-112.5 lg:w-112.5 lg:max-w-full lg:rounded-hero"
          />
          {nextImage && (
            <NftImage
              image={nextImage}
              slot="hero"
              alt=""
              className="absolute top-22 -left-3.5 size-14.5 rounded-artwork-mobile border-2 border-surface-dark object-cover max-[400px]:hidden lg:hidden"
            />
          )}
        </div>
      )}
    </div>
  )
}
