import { MS_PER_DAY, STREAK_GRACE_DAYS } from '@/config/constants'

export function toYMD(d: Date | string | null): string | null {
  if (d === null) return null
  if (typeof d === 'string') return d.length >= 10 ? d.slice(0, 10) : d
  return d.toISOString().slice(0, 10)
}

export function daysBetween(fromYMD: string, toYMD: string): number {
  const a = new Date(`${fromYMD}T00:00:00Z`).getTime()
  const b = new Date(`${toYMD}T00:00:00Z`).getTime()
  return Math.round((b - a) / MS_PER_DAY)
}

/**
 * Pure streak transition.
 * - no history       -> 1
 * - last == today    -> unchanged (idempotent)
 * - gap of 1 day     -> +1
 * - gap <= grace     -> unchanged (grace window)
 * - gap > grace      -> 1 (reset)
 */
export function nextStreak(
  current: number,
  lastStreakDayYMD: string | null,
  todayYMD: string,
  graceDays: number = STREAK_GRACE_DAYS,
): number {
  if (!lastStreakDayYMD) return 1
  const gap = daysBetween(lastStreakDayYMD, todayYMD)
  if (gap <= 0) return current
  if (gap === 1) return current + 1
  if (gap <= graceDays) return current
  return 1
}
