'use client'

import { FormEvent, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { apiFetch } from '@/lib/http'
import { createClient } from '@/lib/supabase/client'
import { copy } from '@/content/en'

type Props = {
  open: boolean
  onClose: () => void
}

export function DeleteAccountDialog({ open, onClose }: Props) {
  const router = useRouter()
  const toast = useToast()
  const passwordRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<1 | 2>(1)
  const [password, setPassword] = useState('')
  const [passwordErr, setPasswordErr] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  function reset() {
    setStep(1)
    setPassword('')
    setPasswordErr(null)
    setPending(false)
  }

  function close() {
    reset()
    onClose()
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (pending) return
    setPasswordErr(null)
    setPending(true)

    const res = await apiFetch<{ deleted: true }>('/api/account/delete', {
      method: 'POST',
      body: JSON.stringify({ password }),
    })

    if (!res.ok) {
      setPending(false)
      if (res.error.code === 'VALIDATION_ERROR') {
        const details = res.error.details as
          | { fields?: Record<string, string> }
          | undefined
        setPasswordErr(
          details?.fields?.password ?? copy.errors.VALIDATION_ERROR,
        )
        return
      }
      const msg =
        (copy.errors as Record<string, string | undefined>)[res.error.code] ??
        copy.errors.generic
      toast.error(msg)
      return
    }

    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <Dialog open={open} onClose={close} title={copy.settings.deleteTitle}>
      {step === 1 ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-[var(--text)]">
            {copy.settings.deleteExplain}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => {
                setStep(2)
                requestAnimationFrame(() => passwordRef.current?.focus())
              }}
            >
              {copy.settings.deleteUnderstand}
            </Button>
            <Button type="button" variant="secondary" onClick={close}>
              {copy.settings.deleteCancel}
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <Input
            ref={passwordRef}
            label={copy.settings.deletePasswordLabel}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={passwordErr}
            required
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--danger)] px-5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              {pending ? '…' : copy.settings.deleteFinal}
            </button>
            <Button type="button" variant="secondary" onClick={close}>
              {copy.settings.deleteCancel}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  )
}
