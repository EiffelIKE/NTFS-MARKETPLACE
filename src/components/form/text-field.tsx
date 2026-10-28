import type * as React from 'react'

import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

import { useFieldContext } from './form-context'
import { useFieldMessage } from './messages'
import { clearServerError } from './server-errors'

export interface TextFieldProps extends Omit<
  React.ComponentProps<typeof Input>,
  'value' | 'defaultValue' | 'onChange' | 'onBlur' | 'name' | 'id'
> {
  label: string
  /** Keeps the label for assistive tech only (Figma shows placeholders). */
  hideLabel?: boolean
  description?: React.ReactNode
  fieldClassName?: string
}

/** A text input bound to the surrounding `form.AppField` (AUTH-01, AUTH-22). */
export function TextField({
  label,
  hideLabel,
  description,
  fieldClassName,
  className,
  ...props
}: TextFieldProps) {
  const field = useFieldContext<string>()
  const message = useFieldMessage(field)

  return (
    <Field invalid={message !== undefined} className={fieldClassName}>
      <FieldLabel className={cn(hideLabel && 'sr-only')}>{label}</FieldLabel>
      <Input
        name={field.name}
        value={field.state.value}
        className={className}
        onChange={(event) => {
          field.handleChange(event.target.value)
          clearServerError(field)
        }}
        onBlur={field.handleBlur}
        {...props}
      />
      {description && <FieldDescription>{description}</FieldDescription>}
      <FieldError>{message}</FieldError>
    </Field>
  )
}
