'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { copy } from '@/content/en'
// import { ChangeEmailDialog } from './ChangeEmailDialog'
import { DeleteAccountDialog } from './DeleteAccountDialog'

type Props = { email: string }

export function SettingsShell({ email }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [signingOut, setSigningOut] = useState(false)
  // const [changeOpen, setChangeOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  async function signOut() {
    if (signingOut) return
    setSigningOut(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signOut()
    if (error) {
      toast.error(copy.errors.generic)
      setSigningOut(false)
      return
    }
    router.push('/')
    router.refresh()
  }

  return (
    <>
      <h1
        className="font-semibold text-[var(--text)]"
        style={{
          fontFamily: 'var(--font-fraunces)',
          fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
        }}
      >
        {copy.settings.heading}
      </h1>

      <section className="mt-6">
        <h2
          className="text-lg font-semibold text-[var(--text)]"
          style={{ fontFamily: 'var(--font-fraunces)' }}
        >
          {copy.settings.accountHeading}
        </h2>
        <Card className="mt-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-[var(--muted)]">
                {copy.settings.emailLabel}
              </p>
              <p className="text-[var(--text)]">{email}</p>
            </div>
            {/* <Button
              type="button"
              variant="secondary"
              onClick={() => setChangeOpen(true)}
            >
              {copy.settings.changeEmail}
            </Button> */}
          </div>
        </Card>
      </section>

      <section className="mt-6">
        <h2
          className="text-lg font-semibold text-[var(--text)]"
          style={{ fontFamily: 'var(--font-fraunces)' }}
        >
          {copy.settings.sessionHeading}
        </h2>
        <Card className="mt-3">
          <Button
            type="button"
            variant="secondary"
            onClick={signOut}
            pending={signingOut}
          >
            {copy.settings.signOut}
          </Button>
        </Card>
      </section>

      <section className="mt-6">
        <h2
          className="text-lg font-semibold text-[var(--danger)]"
          style={{ fontFamily: 'var(--font-fraunces)' }}
        >
          {copy.settings.dangerHeading}
        </h2>
        <Card className="mt-3">
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--danger)] bg-transparent px-5 text-sm font-medium text-[var(--danger)] hover:bg-[var(--danger)]/10"
          >
            {copy.settings.deleteAccount}
          </button>
        </Card>
      </section>

      {/* <ChangeEmailDialog
        open={changeOpen}
        onClose={() => setChangeOpen(false)}
        currentEmail={email}
      /> */}
      <DeleteAccountDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
      />
    </>
  )
}
