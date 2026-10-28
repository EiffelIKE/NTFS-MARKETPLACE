import { createFormHookContexts } from '@tanstack/react-form'

// Split from `app-form.ts` so the field components can read the contexts without importing the
// module that imports them.
export const { fieldContext, formContext, useFieldContext, useFormContext } =
  createFormHookContexts()
