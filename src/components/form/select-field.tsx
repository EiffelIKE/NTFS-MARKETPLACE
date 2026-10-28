import type * as React from 'react'

import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

import { useFieldContext } from './form-context'
import { useFieldMessage } from './messages'
import { RequiredMark } from './required-mark'
import { clearServerError } from './server-errors'

export interface SelectFieldProps {
  label: string
  placeholder: string
  options: readonly { value: string; label: string }[]
  description?: React.ReactNode
  required?: boolean
  fieldClassName?: string
  /** Classes of the trigger (the field surface). */
  className?: string
  /** Runs after the value changed, e.g. to re-validate a dependent field. */
  onValueChange?: (value: string) => void
}

/**
 * A `Select` bound to the surrounding `form.AppField`. The value is the option's string, or `''`
 * while nothing is chosen (the placeholder shows). The label, description and error are wired by
 * `Field`, so the trigger is named and invalid like a text input.
 */
export function SelectField({
  label,
  placeholder,
  options,
  description,
  required,
  fieldClassName,
  className,
  onValueChange,
}: SelectFieldProps) {
  const field = useFieldContext<string>()
  const message = useFieldMessage(field)

  return (
    <Field invalid={message !== undefined} className={fieldClassName}>
      <FieldLabel className={cn(required && 'gap-0.5')}>
        {label}
        {required && <RequiredMark />}
      </FieldLabel>
      <Select
        value={field.state.value}
        onValueChange={(value) => {
          field.handleChange(value)
          clearServerError(field)
          onValueChange?.(value)
        }}
      >
        <SelectTrigger
          aria-required={required ? true : undefined}
          className={cn('h-10 w-full rounded-sm border px-3', className)}
          onBlur={field.handleBlur}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {description && <FieldDescription>{description}</FieldDescription>}
      <FieldError>{message}</FieldError>
    </Field>
  )
}
