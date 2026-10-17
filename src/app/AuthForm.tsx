'use client'

import { useState } from 'react'
import type { SyntheticEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { copy } from '@/content/en'

type Mode = 'signin' | 'signup'

function friendlyAuthError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login') || m.includes('invalid credentials')) {
    return 'That email and password did not match. Try again.'
  }
  if (
    m.includes('already registered') ||
    m.includes('already been registered')
  ) {
    return 'An account with that email already exists. Try signing in.'
  }
  if (m.includes('password') && m.includes('6')) {
    return 'Password must be at least 6 characters.'
  }
  if (m.includes('email') && m.includes('valid')) {
    return 'That does not look like a valid email address.'
  }
  if (m.includes('rate') || m.includes('too many')) {
    return 'Too many attempts. Wait a minute and try again.'
  }
  return copy.errors.generic
}

export function AuthForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const toast = useToast()
  const signinRequired = searchParams?.get('signin') === 'required'

  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)

  async function onSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    if (pending) return
    setPending(true)
    const supabase = createClient()
    try {
      const { error } =
        mode === 'signin'
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({ email, password })

      if (error) {
        toast.error(friendlyAuthError(error.message))
        return
      }
      router.push('/dashboard')
      router.refresh()
    } catch {
      toast.error(copy.errors.generic)
    } finally {
      setPending(false)
    }
  }

  const title = mode === 'signin' ? copy.auth.signInTitle : copy.auth.signUpTitle
  const submitLabel = mode === 'signin' ? copy.auth.signIn : copy.auth.signUp
  const toggleLabel =
    mode === 'signin' ? copy.auth.toggleToSignUp : copy.auth.toggleToSignIn

  return (
    <>
      {signinRequired ? (
        <p
          role="status"
          className="mt-6 rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text)]"
        >
          {copy.errors.UNAUTHENTICATED}
        </p>
      ) : null}

      <h2
        className="mt-10 font-semibold text-[var(--text)]"
        style={{
          fontFamily: 'var(--font-fraunces)',
          fontSize: 'clamp(1.2rem, 2.5vw, 1.5rem)',
        }}
      >
        {title}
      </h2>

      <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-4" noValidate>
        <Input
          label={copy.auth.emailLabel}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          label={copy.auth.passwordLabel}
          type="password"
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <div className="mt-2 flex items-center gap-4">
          <Button type="submit" pending={pending}>
            {submitLabel}
          </Button>
          <button
            type="button"
            onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
            className="text-sm text-[var(--primary-strong)] underline underline-offset-4 hover:no-underline"
          >
            {toggleLabel}
          </button>
        </div>
      </form>
    </>
  )
}
