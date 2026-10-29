import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// tailwind-merge must know the custom theme scales (src/styles/theme.css); otherwise it reads
// `text-body-lg` as a color and drops it when merged with `text-ink`.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [
        'display',
        'heading',
        'title',
        'body-lg',
        'body-md',
        'body',
        'caption',
        'caption-sm',
        'tiny',
      ],
      radius: [
        'input-mobile',
        'hero-mobile',
        'icon-button',
        'artwork',
        'artwork-mobile',
        'artwork-lg',
        'card-mobile',
        'hero',
      ],
      shadow: ['input'],
      tracking: ['brand'],
      container: ['page'],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
