import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'

import { AlertCircleIcon } from '@/components/icons'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

// Field primitives (DS-17). `Field` owns the ids; label, description, error and the control read
// them from context, so `htmlFor`, `aria-describedby` and `aria-invalid` are wired automatically.

interface FieldContextValue {
  controlId: string
  descriptionId: string
  errorId: string
  invalid: boolean
  hasDescription: boolean
  hasError: boolean
  register: (part: 'description' | 'error', present: boolean) => void
}

const FieldContext = React.createContext<FieldContextValue | null>(null)

/** Props a control (`Input`, `Textarea`, `SelectTrigger`, …) applies when rendered in a `Field`. */
function useFieldControl(props: {
  id?: string | undefined
  'aria-describedby'?: string | undefined
  'aria-invalid'?: React.AriaAttributes['aria-invalid']
}) {
  const field = React.useContext(FieldContext)
  if (!field) return props
  const describedBy = [
    props['aria-describedby'],
    field.hasDescription ? field.descriptionId : undefined,
    field.hasError ? field.errorId : undefined,
  ]
    .filter(Boolean)
    .join(' ')
  return {
    id: props.id ?? field.controlId,
    'aria-describedby': describedBy || undefined,
    'aria-invalid': props['aria-invalid'] ?? (field.invalid || undefined),
  }
}

function useRegister(part: 'description' | 'error', present: boolean) {
  const register = React.useContext(FieldContext)?.register
  React.useLayoutEffect(() => {
    if (!register) return
    register(part, present)
    return () => {
      register(part, false)
    }
  }, [register, part, present])
}

function FieldSet({ className, ...props }: React.ComponentProps<'fieldset'>) {
  return (
    <fieldset
      data-slot="field-set"
      className={cn('flex min-w-0 flex-col gap-4', className)}
      {...props}
    />
  )
}

function FieldLegend({ className, ...props }: React.ComponentProps<'legend'>) {
  return (
    <legend
      data-slot="field-legend"
      className={cn('mb-3 text-body-lg font-bold text-foreground', className)}
      {...props}
    />
  )
}

function FieldGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="field-group"
      className={cn('flex w-full flex-col gap-6', className)}
      {...props}
    />
  )
}

const fieldVariants = cva('group/field flex w-full gap-2', {
  variants: {
    orientation: {
      vertical: 'flex-col',
      horizontal: 'flex-row items-center gap-3',
    },
  },
  defaultVariants: {
    orientation: 'vertical',
  },
})

function Field({
  className,
  orientation = 'vertical',
  invalid = false,
  ...props
}: React.ComponentProps<'div'> &
  VariantProps<typeof fieldVariants> & {
    invalid?: boolean
  }) {
  const id = React.useId()
  const [parts, setParts] = React.useState({ description: false, error: false })
  const register = React.useCallback((part: 'description' | 'error', present: boolean) => {
    setParts((current) => (current[part] === present ? current : { ...current, [part]: present }))
  }, [])
  const value = React.useMemo<FieldContextValue>(
    () => ({
      controlId: `${id}-control`,
      descriptionId: `${id}-description`,
      errorId: `${id}-error`,
      invalid,
      hasDescription: parts.description,
      hasError: parts.error,
      register,
    }),
    [id, invalid, parts, register],
  )

  return (
    <FieldContext value={value}>
      <div
        role="group"
        data-slot="field"
        data-orientation={orientation}
        data-invalid={invalid || undefined}
        className={cn(fieldVariants({ orientation }), className)}
        {...props}
      />
    </FieldContext>
  )
}

function FieldContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="field-content"
      className={cn('flex flex-1 flex-col gap-1', className)}
      {...props}
    />
  )
}

function FieldLabel({ className, htmlFor, ...props }: React.ComponentProps<typeof Label>) {
  const field = React.useContext(FieldContext)
  return (
    <Label
      data-slot="field-label"
      htmlFor={htmlFor ?? field?.controlId}
      className={cn('w-fit', className)}
      {...props}
    />
  )
}

function FieldTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="field-title"
      className={cn('text-body font-medium text-foreground', className)}
      {...props}
    />
  )
}

function FieldDescription({ className, ...props }: React.ComponentProps<'p'>) {
  const field = React.useContext(FieldContext)
  useRegister('description', true)
  return (
    <p
      data-slot="field-description"
      id={field?.descriptionId}
      className={cn('text-caption-sm text-text-secondary', className)}
      {...props}
    />
  )
}

function FieldSeparator({ children, className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="field-separator" className={cn('relative h-5', className)} {...props}>
      <Separator className="absolute inset-0 top-1/2" />
      {children && (
        <span className="relative mx-auto block w-fit bg-background px-2 text-caption-sm text-text-secondary">
          {children}
        </span>
      )}
    </div>
  )
}

/** Error text with an icon, so the state never relies on color alone. Renders nothing when empty. */
function FieldError({ className, children, ...props }: React.ComponentProps<'p'>) {
  const field = React.useContext(FieldContext)
  const present = Boolean(children)
  useRegister('error', present)
  if (!present) return null
  return (
    <p
      data-slot="field-error"
      id={field?.errorId}
      className={cn('flex items-start gap-1.5 text-caption font-normal text-error', className)}
      {...props}
    >
      <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  )
}

export {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
  useFieldControl,
}
