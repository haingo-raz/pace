'use client'

import { ButtonHTMLAttributes, forwardRef } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  pending?: boolean
}

const base =
  'inline-flex items-center justify-center gap-2 rounded-full px-5 min-h-11 ' +
  'text-sm font-medium transition-colors disabled:cursor-not-allowed ' +
  'disabled:opacity-60 whitespace-nowrap'

const variants: Record<Variant, string> = {
  primary:
    'bg-[var(--primary-strong)] text-white hover:bg-[var(--primary-strong)]/90',
  secondary:
    'bg-[var(--surface)] text-[var(--text)] border border-[var(--border)] hover:bg-[var(--raised)]',
  ghost:
    'bg-transparent text-[var(--text)] hover:bg-[var(--surface)]',
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', pending = false, disabled, className = '', children, style, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={`${base} ${variants[variant]} ${className}`}
      style={{ minWidth: '7rem', ...style }}
      {...rest}
    >
      <span className="inline-flex items-center gap-2">
        {pending ? (
          <span
            aria-hidden="true"
            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
        ) : null}
        {children}
      </span>
    </button>
  )
})
