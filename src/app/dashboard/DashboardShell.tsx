'use client'

import { useEffect, useRef, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { PointsBadge } from '@/components/PointsBadge'
import { MoodCheckIn } from '@/components/MoodCheckIn'
import { SignOutButton } from './SignOutButton'
import { POINTS_DELTA_MS } from '@/config/constants'
import { copy } from '@/content/en'
import type { CheckinResponse } from '@/types'

type Props = {
  pointsTotal: number
  streakCount: number
  hasCheckedIn: boolean
}

export function DashboardShell({
  pointsTotal: initialPoints,
  streakCount,
  hasCheckedIn: initialChecked,
}: Props) {
  const [points, setPoints] = useState(initialPoints)
  const [delta, setDelta] = useState<number | null>(null)
  const [hasCheckedIn, setHasCheckedIn] = useState(initialChecked)
  const loggedRef = useRef<HTMLDivElement>(null)
  const shouldFocusLogged = useRef(false)
  const deltaTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (hasCheckedIn && shouldFocusLogged.current && loggedRef.current) {
      loggedRef.current.focus()
      shouldFocusLogged.current = false
    }
  }, [hasCheckedIn])

  useEffect(() => {
    return () => {
      if (deltaTimer.current) clearTimeout(deltaTimer.current)
    }
  }, [])

  function onCheckedIn(res: CheckinResponse | null) {
    if (res && res.pointsAwarded > 0) {
      setPoints(res.pointsTotal)
      setDelta(res.pointsAwarded)
      if (deltaTimer.current) clearTimeout(deltaTimer.current)
      deltaTimer.current = setTimeout(() => setDelta(null), POINTS_DELTA_MS)
    }
    shouldFocusLogged.current = true
    setHasCheckedIn(true)
  }

  return (
    <>
      <header className="flex items-center justify-between gap-4">
        <h1
          className="font-semibold text-[var(--text)]"
          style={{
            fontFamily: 'var(--font-fraunces)',
            fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
            textWrap: 'balance',
          }}
        >
          {copy.app.name}
        </h1>
        <div className="flex items-center gap-3">
          <PointsBadge total={points} delta={delta} />
          <span
            className="text-sm text-[var(--muted)]"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {copy.dashboard.streakLabel}{' '}
            <span
              className="text-[var(--text)] font-semibold"
              style={{ fontFamily: 'var(--font-jetbrains)' }}
            >
              {streakCount}
            </span>
          </span>
        </div>
      </header>

      <section className="mt-6">
        {hasCheckedIn ? (
          <Card
            ref={loggedRef}
            tabIndex={-1}
            aria-live="polite"
            className="focus:outline-none"
          >
            <p className="text-[var(--muted)]">{copy.checkin.done}</p>
          </Card>
        ) : (
          <MoodCheckIn onCheckedIn={onCheckedIn} />
        )}
      </section>

      <section className="mt-6">
        <Card>
          <h2
            className="font-semibold text-[var(--text)]"
            style={{
              fontFamily: 'var(--font-fraunces)',
              fontSize: 'clamp(1.2rem, 2.5vw, 1.5rem)',
            }}
          >
            {copy.tasks.heading}
          </h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {copy.tasks.empty}
          </p>
        </Card>
      </section>

      <div className="mt-10">
        <SignOutButton />
      </div>
    </>
  )
}
