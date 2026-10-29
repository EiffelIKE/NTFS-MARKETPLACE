import * as React from 'react'

import { EyeIcon, EyeOffIcon } from '@/components/icons'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group'

/** Password field with a show/hide toggle (login, sign-up, profile). */
function PasswordInput({
  className,
  ...props
}: Omit<React.ComponentProps<typeof InputGroupInput>, 'type'>) {
  const [visible, setVisible] = React.useState(false)
  return (
    <InputGroup className={className}>
      <InputGroupInput type={visible ? 'text' : 'password'} {...props} />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
          aria-pressed={visible}
          className="text-text-secondary"
          onClick={() => {
            setVisible((v) => !v)
          }}
        >
          {visible ? <EyeIcon className="size-4.5" /> : <EyeOffIcon className="size-4.5" />}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  )
}

export { PasswordInput }
