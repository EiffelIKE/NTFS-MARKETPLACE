import { useEffect, useRef, useState } from 'react'

import { focusFirstInvalid } from '@/lib/forms'

/**
 * Moves focus after the form has re-rendered with its errors (AUTH-02, AUTH-03). Focusing right
 * away would find no `aria-invalid` yet, so the request is a state change handled in an effect.
 */
export function useFormFocus() {
  const formRef = useRef<HTMLFormElement>(null)
  const [request, setRequest] = useState<{ tick: number; name: string | null }>({
    tick: 0,
    name: null,
  })

  useEffect(() => {
    if (request.tick === 0) return
    const form = formRef.current
    if (request.name === null) {
      focusFirstInvalid(form)
      return
    }
    const control = form?.elements.namedItem(request.name)
    if (control instanceof HTMLElement) control.focus()
  }, [request])

  return {
    formRef,
    /** The first control with `aria-invalid="true"`. */
    focusFirstInvalid: () => {
      setRequest((current) => ({ tick: current.tick + 1, name: null }))
    },
    /** The control with this `name`. */
    focusField: (name: string) => {
      setRequest((current) => ({ tick: current.tick + 1, name }))
    },
  }
}
