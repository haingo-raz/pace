'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
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
    <Button variant="secondary" onClick={onClick} pending={pending}>
{copy.auth.signOut}
    </Button>
  )
}
