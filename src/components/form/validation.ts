import { revalidateLogic } from '@tanstack/react-form'

/** Validate on blur until the first submit, and on every change after it (AUTH-01). */
export const formValidation = () => revalidateLogic({ mode: 'blur', modeAfterSubmission: 'change' })
