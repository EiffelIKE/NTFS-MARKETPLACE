import type * as React from 'react'

import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { PasswordInput } from '@/components/ui/password-input'
import { cn } from '@/lib/utils'

import { useFieldContext } from './form-context'
import { useFieldMessage } from './messages'
import { RequiredMark } from './required-mark'
import { clearServerError } from './server-errors'

export interface PasswordFieldProps extends Omit<
  React.ComponentProps<typeof PasswordInput>,
  'value' | 'defaultValue' | 'onChange' | 'onBlur' | 'name' | 'id'
> {
  label: string
  hideLabel?: boolean
  description?: React.ReactNode
  fieldClassName?: string
  required?: boolean
}

/** Password input with the show/hide toggle, bound to the surrounding `form.AppField`. */
export function PasswordField({
  label,
  hideLabel,
  description,
  fieldClassName,
  required,
  ...props
}: PasswordFieldProps) {
  const field = useFieldContext<string>()
  const message = useFieldMessage(field)

  return (
    <Field invalid={message !== undefined} className={fieldClassName}>
      <FieldLabel className={cn(hideLabel && 'sr-only', required && 'gap-0.5')}>
        {label}
        {required && <RequiredMark />}
      </FieldLabel>
      <PasswordInput
        name={field.name}
        value={field.state.value}
        onChange={(event) => {
          field.handleChange(event.target.value)
          clearServerError(field)
        }}
        onBlur={field.handleBlur}
        aria-required={required ? true : undefined}
        {...props}
      />
      {description && <FieldDescription>{description}</FieldDescription>}
      <FieldError>{message}</FieldError>
    </Field>
  )
}
