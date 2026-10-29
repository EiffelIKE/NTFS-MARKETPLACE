import { createFormHook } from '@tanstack/react-form'

import { EnsField } from './ens-field'
import { fieldContext, formContext } from './form-context'
import { FormAlert } from './form-alert'
import { PasswordField } from './password-field'
import { SelectField } from './select-field'
import { SubmitButton } from './submit-button'
import { TextField } from './text-field'
import { TextareaField } from './textarea-field'

/**
 * The shared form layer (spec 04 design §8; reused by specs 08 and 09): TanStack Form with the
 * project's field components. Validate with a Zod schema through `validators.onDynamic` and
 * `validationLogic: formValidation()` (blur first, then on change once a submit failed).
 */
export const { useAppForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: { TextField, TextareaField, PasswordField, SelectField, EnsField },
  formComponents: { SubmitButton, FormAlert },
})
