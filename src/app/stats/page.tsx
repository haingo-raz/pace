import { connection } from 'next/server'
import { AppShell } from '@/components/ui/AppShell'
import { Card } from '@/components/ui/Card'
import { LineChart } from '@/components/LineChart'
import { BarChart } from '@/components/BarChart'
import { requireUser } from '@/lib/auth'
import { getStats } from '@/lib/queries/stats'
import { getProfile } from '@/lib/queries/profile'
import { todayFor } from '@/lib/queries/day'
import { copy, fill } from '@/content/en'
import {
  DEFAULT_TIMEZONE,
  MOOD_MAX,
  MOOD_MIN,
  ONE_DECIMAL,
  STATS_DAYS_DEFAULT,
  STATS_DAYS_MAX,
  STATS_DAYS_MIN,
  STATS_MIN_DATA_DAYS,
} from '@/config/constants'

export const instant = false

type SearchParams = Promise<{ days?: string }>

function clampDays(raw: string | undefined): number {
  const parsed = raw === undefined ? NaN : Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed)) return STATS_DAYS_DEFAULT
  return Math.max(STATS_DAYS_MIN, Math.min(STATS_DAYS_MAX, parsed))
}

function round1(n: number): string {
  return (Math.round(n * ONE_DECIMAL) / ONE_DECIMAL).toFixed(1)
}

export default async function StatsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  await connection()
  const { days: daysParam } = await searchParams
  const days = clampDays(daysParam)
  const userId = await requireUser()
  const profile = await getProfile(userId)
  const timezone = profile?.timezone ?? DEFAULT_TIMEZONE
  const today = todayFor(timezone)
  const stats = await getStats(userId, timezone, today, days)
  const streak = profile?.streak_count ?? 0
  const hasData = stats.totals.checkinsInRange >= STATS_MIN_DATA_DAYS

  return (
    <AppShell>
      <header>
        <h1
          className="font-semibold text-[var(--text)]"
          style={{
            fontFamily: 'var(--font-fraunces)',
            fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
          }}
        >
          {copy.stats.heading}
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {fill(copy.stats.rangeLabel, { days })}
        </p>
      </header>

      <section className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Figure label={copy.stats.streakFigure} value={String(streak)} />
        <Figure
          label={fill(copy.stats.pointsRangeFigure, { days })}
          value={String(stats.totals.pointsInRange)}
        />
        <Figure
          label={copy.stats.weeklyMoodFigure}
          value={
            stats.weeklyAvgMood === null
              ? copy.stats.unknown
              : `${round1(stats.weeklyAvgMood)} ${copy.stats.weeklyMoodUnit}`
          }
        />
      </section>

      {hasData ? (
        <section className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card>
            <h2
              className="font-semibold text-[var(--text)]"
              style={{
                fontFamily: 'var(--font-fraunces)',
                fontSize: 'clamp(1.1rem, 2vw, 1.25rem)',
              }}
            >
              {copy.stats.moodChartTitle}
            </h2>
            <div className="mt-3">
              <LineChart
                title={copy.stats.moodChartTitle}
                data={stats.mood}
                min={MOOD_MIN}
                max={MOOD_MAX}
                unit={copy.stats.moodChartUnit}
              />
            </div>
          </Card>
          <Card>
            <h2
              className="font-semibold text-[var(--text)]"
              style={{
                fontFamily: 'var(--font-fraunces)',
                fontSize: 'clamp(1.1rem, 2vw, 1.25rem)',
              }}
            >
              {copy.stats.pointsChartTitle}
            </h2>
            <div className="mt-3">
              <BarChart
                title={copy.stats.pointsChartTitle}
                data={stats.points}
                unit={copy.stats.pointsChartUnit}
              />
            </div>
          </Card>
        </section>
      ) : (
        <section className="mt-6">
          <Card>
            <h2
              className="font-semibold text-[var(--text)]"
              style={{
                fontFamily: 'var(--font-fraunces)',
                fontSize: 'clamp(1.1rem, 2vw, 1.25rem)',
              }}
            >
              {copy.stats.emptyHeading}
            </h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {copy.stats.emptyBody}
            </p>
          </Card>
        </section>
      )}
    </AppShell>
  )
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <p className="text-sm text-[var(--muted)]">{label}</p>
      <p
        className="mt-1 text-2xl font-semibold text-[var(--text)]"
        style={{
          fontFamily: 'var(--font-jetbrains)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </p>
    </Card>
  )
}
