'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

type ToastKind = 'success' | 'error'
type Toast = { id: number; kind: ToastKind; message: string }

type ToastContextValue = {
  success: (message: string) => void
  error: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const DISMISS_MS = 4000

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, kind, message }])
  }, [])

  const value = useMemo<ToastContextValue>(
    () => ({
      success: (m) => push('success', m),
      error: (m) => push('error', m),
    }),
    [push],
  )

  useEffect(() => {
    if (toasts.length === 0) return
    const timers = toasts.map((t) =>
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== t.id))
      }, DISMISS_MS),
    )
    return () => timers.forEach(clearTimeout)
  }, [toasts])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="region"
        aria-label="Notifications"
        className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            className={
              'pointer-events-auto max-w-sm rounded-md border px-4 py-3 text-sm shadow-md ' +
              (t.kind === 'error'
                ? 'bg-[var(--raised)] border-[var(--danger)] text-[var(--danger)]'
                : 'bg-[var(--raised)] border-[var(--border)] text-[var(--text)]')
            }
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
