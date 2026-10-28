import { useNavigate } from '@tanstack/react-router'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { withChange } from '../model/search'

/**
 * Search from the header icon, or from the tab bar's button away from the catalog (CAT-25).
 * Submitting opens `/?q=<term>#mercado`, which resets every other filter, and focus lands on the
 * catalog heading instead of going back to the trigger, because the context changed.
 */
export function SearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const navigate = useNavigate()
  const [text, setText] = React.useState('')
  const submitted = React.useRef(false)
  // The dialog has no Radix trigger (the header icon and the tab bar button open it from outside),
  // so Radix has nowhere to return focus to: the opener is remembered here (spec 11, A11Y-06).
  const opener = React.useRef<HTMLElement | null>(null)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onOpenAutoFocus={() => {
          opener.current =
            document.activeElement instanceof HTMLElement ? document.activeElement : null
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          if (submitted.current) {
            submitted.current = false
            document.getElementById('mercado-title')?.focus({ preventScroll: true })
          } else {
            opener.current?.focus()
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Buscar NFTs</DialogTitle>
          <DialogDescription>Encontre NFTs por nome, coleção ou criador.</DialogDescription>
        </DialogHeader>
        <form
          role="search"
          className="grid gap-6"
          onSubmit={(event) => {
            event.preventDefault()
            submitted.current = true
            const q = text.trim() || undefined
            void navigate({ to: '/', search: withChange({}, { q }), hash: 'mercado' }).then(() => {
              onOpenChange(false)
              setText('')
            })
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="search-dialog-input">Buscar por nome, coleção ou criador</Label>
            <Input
              id="search-dialog-input"
              type="search"
              autoComplete="off"
              maxLength={80}
              value={text}
              onChange={(event) => {
                setText(event.target.value)
              }}
            />
          </div>
          <DialogFooter>
            <Button type="submit">Buscar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
