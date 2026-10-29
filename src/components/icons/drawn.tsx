import type { SVGProps } from 'react'

import { cn } from '@/lib/utils'

// Icons Figma does not provide (DS-13), drawn in the Iconly Curved style of the exports:
// 24 grid, 1.5 stroke, round caps and joins, `currentColor`. Each is a recorded deviation.

export type IconProps = SVGProps<SVGSVGElement>

function DrawnIcon({ viewBox = '0 0 24 24', ...props }: IconProps) {
  return (
    <svg
      width="1em"
      height="1em"
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    />
  )
}

export function CloseIcon(props: IconProps) {
  return (
    <DrawnIcon {...props}>
      <path d="M17.5 6.5 6.5 17.5M6.5 6.5l11 11" />
    </DrawnIcon>
  )
}

export function CheckIcon(props: IconProps) {
  return (
    <DrawnIcon {...props}>
      <path d="M5.5 12.5 10 17l8.5-9.5" />
    </DrawnIcon>
  )
}

export function AlertCircleIcon(props: IconProps) {
  return (
    <DrawnIcon {...props}>
      <path d="M12 2.75c6.94 0 9.25 2.31 9.25 9.25s-2.31 9.25-9.25 9.25S2.75 18.94 2.75 12 5.06 2.75 12 2.75Z" />
      <path d="M12 8v4.4M11.995 15.9h.01" />
    </DrawnIcon>
  )
}

export function CheckCircleIcon(props: IconProps) {
  return (
    <DrawnIcon {...props}>
      <path d="M12 2.75c6.94 0 9.25 2.31 9.25 9.25s-2.31 9.25-9.25 9.25S2.75 18.94 2.75 12 5.06 2.75 12 2.75Z" />
      <path d="m8.44 12 2.38 2.37 4.74-4.74" />
    </DrawnIcon>
  )
}

export function SpinnerIcon({ className, ...props }: IconProps) {
  return (
    <DrawnIcon className={cn('animate-spin', className)} {...props}>
      <path d="M21 12a9 9 0 1 1-6.22-8.56" />
    </DrawnIcon>
  )
}

/** Visible-password state, derived from the Figma `eye-off` export (same 18 grid and stroke). */
export function EyeIcon(props: IconProps) {
  return (
    <DrawnIcon viewBox="0 0 18 18" {...props}>
      <path d="M2.06 9.1C2.06 6.64 5.17 3.63 9 3.63S15.94 6.64 15.94 9.1 12.83 14.58 9 14.58 2.06 11.56 2.06 9.1Z" />
      <circle cx="9" cy="9.1" r="2.37" />
    </DrawnIcon>
  )
}
