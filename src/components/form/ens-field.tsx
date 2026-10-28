import type * as React from 'react'

import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { cn } from '@/lib/utils'

import { useFieldContext } from './form-context'
import { useFieldMessage } from './messages'
import { RequiredMark } from './required-mark'
import { clearServerError } from './server-errors'

export interface EnsFieldProps {
  label?: string
  required?: boolean
  fieldClassName?: string
  /** Classes of the group (the field surface). */
  className?: string
  description?: React.ReactNode
}

/**
 * The ENS name: the label the user types plus a fixed `.eth` suffix (spec 08 design §4; checkout
 * reuses it). Figma draws the suffix as a one-option select, which would only ever say `.eth`.
 */
export function EnsField({
  label = 'Nome ENS',
  required,
  fieldClassName,
  className,
  description,
}: EnsFieldProps) {
  const field = useFieldContext<string>()
  const message = useFieldMessage(field)

  return (
    <Field invalid={message !== undefined} className={fieldClassName}>
      <FieldLabel className={cn(required && 'gap-0.5')}>
        {label}
        {required && <RequiredMark />}
      </FieldLabel>
      <InputGroup className={className}>
        <InputGroupInput
          name={field.name}
          value={field.state.value}
          autoCapitalize="none"
          autoComplete="off"
          spellCheck={false}
          aria-required={required ? true : undefined}
          onChange={(event) => {
            field.handleChange(event.target.value)
            clearServerError(field)
          }}
          onBlur={field.handleBlur}
        />
        <InputGroupAddon align="inline-end">.eth</InputGroupAddon>
      </InputGroup>
      {description && <FieldDescription>{description}</FieldDescription>}
      <FieldError>{message}</FieldError>
    </Field>
  )
}
