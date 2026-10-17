'use client'

import { COLOUR_PALETTE } from '@/config/constants'
import { copy } from '@/content/en'

type Props = {
  selected: string | null
  onPick: (hex: string) => void
  disabled?: boolean
}

export function ColourPicker({ selected, onPick, disabled = false }: Props) {
  const selectedNorm = selected?.toUpperCase() ?? null
  return (
    <div
      role="group"
      aria-label={copy.coloring.pickerLabel}
      className="flex flex-wrap gap-2"
    >
      {COLOUR_PALETTE.map(({ name, hex }) => {
        const hexNorm = hex.toUpperCase()
        const pressed = selectedNorm === hexNorm
        return (
          <button
            key={hex}
            type="button"
            onClick={() => onPick(hex)}
            aria-pressed={pressed}
            disabled={disabled}
            className={
              'inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium ' +
              'disabled:cursor-not-allowed disabled:opacity-60 ' +
              (pressed
                ? 'border-[var(--primary-strong)] ring-2 ring-[var(--primary-strong)] bg-[var(--raised)] text-[var(--text)]'
                : 'border-[var(--border)] bg-[var(--raised)] text-[var(--text)] hover:border-[var(--primary-strong)]')
            }
          >
            <span
              aria-hidden="true"
              className="inline-block h-4 w-4 rounded-full border border-[var(--border)]"
              style={{ background: hex }}
            />
            <span>{name}</span>
          </button>
        )
      })}
    </div>
  )
}
