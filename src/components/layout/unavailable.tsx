import * as React from 'react'

import { notify } from '@/components/feedback'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

const MESSAGE = 'Disponível em breve'

/**
 * A control that leads outside the deliverable (DS-29): visible for fidelity, `aria-disabled`, with
 * a "Disponível em breve" tooltip and description. Activation never navigates; it shows a toast,
 * which is also the only hint on touch screens.
 */
export function Unavailable({
  as = 'link',
  className,
  children,
  ...props
}: Omit<React.ComponentProps<'span'>, 'role'> & { as?: 'link' | 'button' }) {
  const descriptionId = React.useId()
  const activate = () => {
    notify.info(MESSAGE, { id: 'unavailable' })
  }

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          {/* The role is `link` or `button` (from `as`); jsx-a11y only reads literal roles. */}
          {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
          <span
            role={as}
            aria-disabled="true"
            aria-describedby={descriptionId}
            // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
            tabIndex={0}
            data-unavailable=""
            className={cn('cursor-not-allowed', className)}
            onClick={activate}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || (as === 'button' && event.key === ' ')) {
                event.preventDefault()
                activate()
              }
            }}
            {...props}
          >
            {children}
          </span>
        </TooltipTrigger>
        <TooltipContent>{MESSAGE}</TooltipContent>
      </Tooltip>
      <span id={descriptionId} hidden>
        {MESSAGE}
      </span>
    </>
  )
}
