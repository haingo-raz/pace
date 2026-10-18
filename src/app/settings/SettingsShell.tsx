'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { apiFetch } from '@/lib/http'
import { copy, fill } from '@/content/en'
import type { EmploymentStatus, Profile } from '@/types'
// import { ChangeEmailDialog } from './ChangeEmailDialog'
import { DeleteAccountDialog } from './DeleteAccountDialog'
import { Faq } from '@/components/Faq'
import { ONBOARDING_REPLAY_EVENT } from '@/components/Onboarding'

type Props = {
  email: string
  streakPaused: boolean
  streakCount: number
  employmentStatus: EmploymentStatus | null
  preferredName: string | null
}

const EMPLOYMENT_LABEL: Record<EmploymentStatus, string> = {
  full_time: copy.settings.employmentFullTime,
  part_time: copy.settings.employmentPartTime,
  unemployed: copy.settings.employmentUnemployed,
  volunteer_full_time: copy.settings.employmentVolunteerFullTime,
  volunteer_part_time: copy.settings.employmentVolunteerPartTime,
  student_full_time: copy.settings.employmentStudentFullTime,
  student_part_time: copy.settings.employmentStudentPartTime,
}

const EMPLOYMENT_ORDER: EmploymentStatus[] = [
  'full_time',
  'part_time',
  'unemployed',
  'volunteer_full_time',
  'volunteer_part_time',
  'student_full_time',
  'student_part_time',
]

export function SettingsShell({
  email,
  streakPaused,
  streakCount,
  employmentStatus,
  preferredName,
}: Props) {
  const router = useRouter()
  const toast = useToast()
  const [signingOut, setSigningOut] = useState(false)
  const [paused, setPaused] = useState(streakPaused)
  const [pausing, setPausing] = useState(false)
  const [name, setName] = useState(preferredName ?? '')
  const [employment, setEmployment] = useState<EmploymentStatus | ''>(
    employmentStatus ?? '',
  )
  const [savingPersonal, setSavingPersonal] = useState(false)
  // const [changeOpen, setChangeOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  async function savePersonal() {
    if (savingPersonal) return
    setSavingPersonal(true)
    const res = await apiFetch<{ profile: Profile }>('/api/account/profile', {
      method: 'POST',
      body: JSON.stringify({
        preferred_name: name.trim() || null,
        employment_status: employment === '' ? null : employment,
      }),
    })
    setSavingPersonal(false)
    if (!res.ok) {
      toast.error(copy.settings.personalSaveFailed)
      return
    }
    toast.success(copy.settings.personalSaved)
    router.refresh()
  }

  async function toggleStreak() {
    if (pausing) return
    setPausing(true)
    const next = !paused
    const res = await apiFetch<{ profile: { streak_paused: boolean } }>(
      '/api/account/streak',
      { method: 'POST', body: JSON.stringify({ paused: next }) },
    )
    setPausing(false)
    if (!res.ok) {
      toast.error(copy.errors.generic)
      return
    }
    setPaused(res.data.profile.streak_paused)
    toast.success(
      res.data.profile.streak_paused
        ? copy.settings.streakPausedDone
        : copy.settings.streakResumedDone,
    )
    router.refresh()
  }

  async function replayTour() {
    const res = await apiFetch<{ onboarded_at: string | null }>(
      '/api/me/onboarding',
      {
        method: 'POST',
        body: JSON.stringify({ skipped: false, replay: true }),
      },
    )
    if (!res.ok) {
      toast.error(copy.errors.generic)
      return
    }
    if (window.location.pathname !== '/dashboard') {
      // Push and let the dashboard's mount effect fire the tour via its
      // GET /api/me/onboarding call.
      router.push('/dashboard')
      return
    }
    // Already on dashboard: broadcast the event the component listens for.
    window.dispatchEvent(new CustomEvent(ONBOARDING_REPLAY_EVENT))
  }

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
          {copy.settings.personalHeading}
        </h2>
        <Card className="mt-3">
          <p className="text-sm text-[var(--muted)]">
            {copy.settings.personalExplain}
          </p>
          <div className="mt-4 flex flex-col gap-4">
            <Input
              label={copy.settings.preferredNameLabel}
              placeholder={copy.settings.preferredNamePlaceholder}
              hint={copy.settings.preferredNameHint}
              value={name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
            />
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="employment-status"
                className="text-sm font-medium text-[var(--text)]"
              >
                {copy.settings.employmentLabel}
              </label>
              <select
                id="employment-status"
                value={employment}
                onChange={(e) =>
                  setEmployment(e.target.value as EmploymentStatus | '')
                }
                className="w-full rounded-md border border-[var(--border)] bg-[var(--raised)] px-3 py-2 text-base text-[var(--text)]"
              >
                <option value="">{copy.settings.employmentUnset}</option>
                {EMPLOYMENT_ORDER.map((v) => (
                  <option key={v} value={v}>
                    {EMPLOYMENT_LABEL[v]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Button
                type="button"
                onClick={savePersonal}
                pending={savingPersonal}
              >
                {copy.settings.personalSave}
              </Button>
            </div>
          </div>
        </Card>
      </section>

      <section className="mt-6">
        <h2
          className="text-lg font-semibold text-[var(--text)]"
          style={{ fontFamily: 'var(--font-fraunces)' }}
        >
          {copy.settings.streakHeading}
        </h2>
        <Card className="mt-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[var(--text)] font-medium">
                {paused
                  ? copy.settings.streakStatusPaused
                  : copy.settings.streakStatusActive}
              </p>
              <p className="text-sm text-[var(--muted)]">
                {paused
                  ? fill(copy.settings.streakFrozenAt, { n: streakCount })
                  : copy.settings.streakExplain}
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={toggleStreak}
              pending={pausing}
              aria-pressed={paused}
            >
              {paused ? copy.settings.streakResume : copy.settings.streakPause}
            </Button>
          </div>
        </Card>
      </section>

      <section className="mt-6">
        <h2
          className="text-lg font-semibold text-[var(--text)]"
          style={{ fontFamily: 'var(--font-fraunces)' }}
        >
          {copy.onboarding.heading}
        </h2>
        <Card className="mt-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[var(--muted)]">
              {copy.onboarding.replayHint}
            </p>
            <Button type="button" variant="secondary" onClick={replayTour}>
              {copy.onboarding.replay}
            </Button>
          </div>
        </Card>
      </section>

      <section className="mt-6">
        <h2
          className="text-lg font-semibold text-[var(--text)]"
          style={{ fontFamily: 'var(--font-fraunces)' }}
        >
          {copy.settings.faqHeading}
        </h2>
        <div className="mt-3">
          <Faq items={copy.settings.faq} />
        </div>
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
