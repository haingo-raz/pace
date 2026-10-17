'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { copy } from '@/content/en'

export function SignOutButton() {
  const router = useRouter()
  const toast = useToast()
  const [pending, setPending] = useState(false)

  async function onClick() {
    if (pending) return
    setPending(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signOut()
    if (error) {
      toast.error(copy.errors.generic)
      setPending(false)
      return
    }
    router.push('/')
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-label={copy.settings.signOutIconLabel}
      aria-busy={pending || undefined}
      className="flex h-11 w-11 items-center justify-center rounded-md text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-60"
    >
      <LogOut aria-hidden="true" className="h-5 w-5" />
    </button>
  )
}
