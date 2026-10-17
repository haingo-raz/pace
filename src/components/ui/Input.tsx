'use client'

import { InputHTMLAttributes, forwardRef, useId } from 'react'
import { copy } from '@/content/en'

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  error?: string | null
  hint?: string
}

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { label, error, hint, id, className = '', required, ...rest },
  ref,
) {
  const auto = useId()
  const inputId = id ?? auto
  const errorId = `${inputId}-error`
  const hintId = `${inputId}-hint`

  const describedBy =
    [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') ||
    undefined

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-[var(--text)]">
        {label}
        {required ? (
          <>
            {' '}
            <span
              aria-label={copy.tasks.requiredAria}
              className="text-[var(--primary-strong)]"
            >
              {copy.tasks.requiredIndicator}
            </span>
          </>
        ) : null}
      </label>
      <input
        ref={ref}
        id={inputId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={
          'w-full rounded-md border px-3 py-2 bg-[var(--raised)] text-[var(--text)] text-base ' +
          (error ? 'border-[var(--danger)] ' : 'border-[var(--border)] ') +
          className
        }
        {...rest}
      />
      {hint && !error ? (
        <p id={hintId} className="text-sm text-[var(--muted)]">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}
    </div>
  )
})
