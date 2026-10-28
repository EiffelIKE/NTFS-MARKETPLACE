/**
 * The Figma `*` for a required field (ACC-24). The star is decoration; the text is for assistive
 * tech, so the requirement is never carried by a symbol or a color alone.
 */
export function RequiredMark() {
  return (
    <>
      <span aria-hidden="true" className="text-error">
        *
      </span>
      <span className="sr-only">(obrigatório)</span>
    </>
  )
}
