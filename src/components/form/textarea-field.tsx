import type * as React from 'react'

import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'

import { useFieldContext } from './form-context'
import { useFieldMessage } from './messages'
import { clearServerError } from './server-errors'

export interface TextareaFieldProps extends Omit<
  React.ComponentProps<typeof Textarea>,
  'value' | 'defaultValue' | 'onChange' | 'onBlur' | 'name' | 'id'
> {
  label: string
  description?: React.ReactNode
  fieldClassName?: string
  /** Shows "N/limit" once the text is within 100 characters of the limit. */
  limit?: number
}

/** A multi-line input bound to the surrounding `form.AppField` (checkout note, spec 09). */
export function TextareaField({
  label,
  description,
  fieldClassName,
  limit,
  ...props
}: TextareaFieldProps) {
  const field = useFieldContext<string>()
  const message = useFieldMessage(field)
  const length = field.state.value.length
  const counter = limit !== undefined && length >= limit - 100

  return (
    <Field invalid={message !== undefined} className={fieldClassName}>
      <FieldLabel>{label}</FieldLabel>
      <Textarea
        name={field.name}
        value={field.state.value}
        onChange={(event) => {
          field.handleChange(event.target.value)
          clearServerError(field)
        }}
        onBlur={field.handleBlur}
        {...props}
      />
      {(description !== undefined || counter) && (
        <FieldDescription>
          {description}
          {counter && (
            <span className="block text-right">{`${String(length)}/${String(limit)}`}</span>
          )}
        </FieldDescription>
      )}
      <FieldError>{message}</FieldError>
    </Field>
  )
}
