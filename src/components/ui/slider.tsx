import { Slider as SliderPrimitive } from 'radix-ui'
import * as React from 'react'

import { cn } from '@/lib/utils'

// Figma price range: 2 px track, accent range, 15 px thumbs with a 31 px hit area (DS-16).
function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  thumbLabels,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root> & {
  /** Accessible name per thumb, e.g. ["Preço mínimo", "Preço máximo"]. */
  thumbLabels?: string[]
}) {
  const values = React.useMemo(
    () => (Array.isArray(value) ? value : Array.isArray(defaultValue) ? defaultValue : [min]),
    [value, defaultValue, min],
  )

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn(
        'relative flex h-8 w-full touch-none items-center select-none data-disabled:opacity-60',
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className="relative h-0.5 grow rounded-full bg-border-soft"
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className="absolute h-full bg-text-accent"
        />
      </SliderPrimitive.Track>
      {values.map((_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          aria-label={thumbLabels?.[index]}
          className="relative block size-3.75 cursor-grab rounded-full bg-text-accent before:absolute before:-inset-2 before:rounded-full active:cursor-grabbing data-disabled:cursor-not-allowed"
        />
      ))}
    </SliderPrimitive.Root>
  )
}

export { Slider }
