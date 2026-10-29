import { RadioGroup, RadioGroupChip } from '@/components/ui/radio-group'
import { EditionId, type Edition } from '@/contracts'
import { cn } from '@/lib/utils'

import { isSoldOut } from '../model/purchase'

/**
 * Editions as a single-choice group in the response's order (DET-10, DET-12). A sold-out edition
 * is disabled and struck through, and its name says "esgotada" to assistive tech. A selected
 * edition that sells out while on screen stays selected (DET-24).
 */
export function EditionPicker({
  editions,
  selected,
  onSelect,
  className,
}: {
  editions: readonly Edition[]
  selected: EditionId | null
  onSelect: (id: EditionId) => void
  className?: string
}) {
  return (
    <RadioGroup
      aria-label="Edição"
      value={selected ?? ''}
      onValueChange={(value) => {
        const id = EditionId.safeParse(value)
        if (id.success) onSelect(id.data)
      }}
      className={cn('flex w-auto flex-wrap gap-1.5', className)}
    >
      {editions.map((edition) => (
        <RadioGroupChip
          key={edition.id}
          variant="outline"
          value={edition.id}
          disabled={isSoldOut(edition)}
        >
          {edition.label}
          {isSoldOut(edition) && <span className="sr-only"> — esgotada</span>}
        </RadioGroupChip>
      ))}
    </RadioGroup>
  )
}
