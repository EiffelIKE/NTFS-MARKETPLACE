import type * as React from 'react'

import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

import { useFieldContext } from './form-context'
import { useFieldMessage } from './messages'
import { RequiredMark } from './required-mark'
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
  /** Adds the `*` mark, a hidden "(obrigatório)" and `aria-required` (ACC-24). */
  required?: boolean
  /** Rewrites what the user types before it reaches the form (e.g. upper-case a code). */
  format?: (value: string) => string
}

/** A text input bound to the surrounding `form.AppField` (AUTH-01, AUTH-22). */
export function TextField({
  label,
  hideLabel,
  description,
  fieldClassName,
  className,
  required,
  format,
  ...props
}: TextFieldProps) {
  const field = useFieldContext<string>()
  const message = useFieldMessage(field)

  return (
    <Field invalid={message !== undefined} className={fieldClassName}>
      <FieldLabel className={cn(hideLabel && 'sr-only', required && 'gap-0.5')}>
        {label}
        {required && <RequiredMark />}
      </FieldLabel>
      <Input
        name={field.name}
        value={field.state.value}
        className={className}
        onChange={(event) => {
          field.handleChange(format ? format(event.target.value) : event.target.value)
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
