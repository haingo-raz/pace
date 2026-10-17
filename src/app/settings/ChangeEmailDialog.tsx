'use client'

import { FormEvent, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { apiFetch } from '@/lib/http'
import { copy } from '@/content/en'

type Props = {
  open: boolean
  onClose: () => void
  currentEmail: string
}

export function ChangeEmailDialog({ open, onClose, currentEmail }: Props) {
  const toast = useToast()
  const emailRef = useRef<HTMLInputElement>(null)
  const [newEmail, setNewEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailErr, setEmailErr] = useState<string | null>(null)
  const [passwordErr, setPasswordErr] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  function reset() {
    setNewEmail('')
    setPassword('')
    setEmailErr(null)
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
    setEmailErr(null)
    setPasswordErr(null)
    setPending(true)

    const res = await apiFetch<{ pending: boolean }>(
      '/api/account/change-email',
      {
        method: 'POST',
        body: JSON.stringify({ newEmail: newEmail.trim(), password }),
      },
    )

    setPending(false)
    if (!res.ok) {
      if (res.error.code === 'VALIDATION_ERROR') {
        const details = res.error.details as
          | { fields?: Record<string, string> }
          | undefined
        const fields = details?.fields ?? {}
        if (fields.password) setPasswordErr(fields.password)
        if (fields.newEmail) setEmailErr(fields.newEmail)
        if (!fields.password && !fields.newEmail) {
          toast.error(copy.errors.VALIDATION_ERROR)
        }
        return
      }
      const msg =
        (copy.errors as Record<string, string | undefined>)[res.error.code] ??
        copy.errors.generic
      toast.error(msg)
      return
    }

    toast.success(
      res.data.pending ? copy.settings.changeEmailPending : copy.settings.changeEmailDone,
    )
    close()
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title={copy.settings.changeEmailTitle}
      initialFocusRef={emailRef}
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <div>
          <p className="text-sm text-[var(--muted)]">
            {copy.settings.changeEmailCurrent}
          </p>
          <p className="text-[var(--text)]">{currentEmail}</p>
        </div>
        <Input
          ref={emailRef}
          label={copy.settings.changeEmailNew}
          type="email"
          autoComplete="email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          error={emailErr}
          required
        />
        <Input
          label={copy.settings.changeEmailPassword}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={passwordErr}
          required
        />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" pending={pending}>
            {copy.settings.changeEmailConfirm}
          </Button>
          <Button type="button" variant="secondary" onClick={close}>
            {copy.settings.changeEmailCancel}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
