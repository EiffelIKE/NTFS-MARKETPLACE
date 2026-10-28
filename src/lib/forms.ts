/** Focus the first invalid control after a failed submit (DS-17). Returns whether one was found. */
export function focusFirstInvalid(form: HTMLFormElement | null) {
  const target = form?.querySelector<HTMLElement>('[aria-invalid="true"]')
  target?.focus()
  return Boolean(target)
}
