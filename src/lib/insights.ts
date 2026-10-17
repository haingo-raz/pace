import {
  INSIGHT_DEADLINES_MISSED_MIN,
  INSIGHT_EFFORT_RATIO,
  INSIGHT_GRIND_MOOD_DROP,
  INSIGHT_GRIND_STREAK_MIN,
  INSIGHT_HALF_WINDOW_DAYS,
  INSIGHT_LATE_MIN,
  INSIGHT_LATE_RATIO,
  INSIGHT_LOW_CONSEC_DAYS,
  INSIGHT_LOW_MOOD_MAX,
  INSIGHT_MIN_CHECKINS,
  INSIGHT_NOT_RECOVERING_POINTS,
  ONE_DECIMAL,
} from '@/config/constants'
import type { InsightDayRow } from '@/lib/queries/insights'

export type InsightKind =
  | 'NEED_MORE_DATA'
  | 'GRINDING'
  | 'SUSTAINED_LOW'
  | 'EFFORT_CLIMBING'
  | 'DEADLINES_SLIP'
  | 'NOT_RECOVERING'
  | 'LATE_NIGHTS'
  | 'RECOVERING'
  | 'STEADY'

export type SparkSeries = {
  label: 'mood' | 'effort' | 'late'
  values: Array<number | null>
}

export type InsightEvidence = {
  primary: SparkSeries
  secondary: SparkSeries
  numbers: Record<string, number>
}

export type Insight = {
  kind: InsightKind
  evidence: InsightEvidence
}

export type DetectMeta = {
  streak: number
  deadlinesMissed: number
  pointsLast7: number
  sectionsLast7: number
}

function average(values: Array<number | null>): number | null {
  const present = values.filter((v): v is number => v !== null)
  if (present.length === 0) return null
  return present.reduce((a, b) => a + b, 0) / present.length
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0)
}

function splitWindows<T>(all: T[]): { previous: T[]; last: T[] } {
  const half = INSIGHT_HALF_WINDOW_DAYS
  const total = all.length
  return {
    previous: all.slice(0, total - half),
    last: all.slice(total - half),
  }
}

/** True if the mood 7-day avg is lower than the previous 7-day avg. */
function moodTrendingDown(prevMood: number | null, lastMood: number | null): boolean {
  if (prevMood === null || lastMood === null) return false
  return lastMood < prevMood
}

function moodTrendingUp(prevMood: number | null, lastMood: number | null): boolean {
  if (prevMood === null || lastMood === null) return false
  return lastMood > prevMood
}

export function detectInsight(
  rows: InsightDayRow[],
  meta: DetectMeta,
): Insight {
  const moods = rows.map((r) => r.mood)
  const efforts = rows.map((r) => r.effort)
  const lates = rows.map((r) => r.late_events)

  const checkinCount = moods.filter((m) => m !== null).length

  const moodWindows = splitWindows(moods)
  const effortWindows = splitWindows(efforts)
  const lateWindows = splitWindows(lates)

  const lastMoodAvg = average(moodWindows.last)
  const prevMoodAvg = average(moodWindows.previous)
  const lastEffortSum = sum(effortWindows.last)
  const prevEffortSum = sum(effortWindows.previous)
  const lastLateSum = sum(lateWindows.last)
  const prevLateSum = sum(lateWindows.previous)

  const moodSpark: SparkSeries = { label: 'mood', values: moods }
  const effortSpark: SparkSeries = { label: 'effort', values: efforts }
  const lateSpark: SparkSeries = { label: 'late', values: lates }

  if (checkinCount < INSIGHT_MIN_CHECKINS) {
    return {
      kind: 'NEED_MORE_DATA',
      evidence: {
        primary: moodSpark,
        secondary: effortSpark,
        numbers: { checkinCount },
      },
    }
  }

  // GRINDING: streak high, mood dropped by threshold.
  if (
    meta.streak >= INSIGHT_GRIND_STREAK_MIN &&
    lastMoodAvg !== null &&
    prevMoodAvg !== null &&
    prevMoodAvg - lastMoodAvg >= INSIGHT_GRIND_MOOD_DROP
  ) {
    return {
      kind: 'GRINDING',
      evidence: {
        primary: moodSpark,
        secondary: {
          label: 'effort',
          values: efforts,
        },
        numbers: {
          streak: meta.streak,
          lastMoodAvg: round1(lastMoodAvg),
          prevMoodAvg: round1(prevMoodAvg),
        },
      },
    }
  }

  // SUSTAINED_LOW: >= INSIGHT_LOW_CONSEC_DAYS days in a row at or below LOW_MAX.
  const consecLow = longestLowRun(moods, INSIGHT_LOW_MOOD_MAX)
  if (consecLow >= INSIGHT_LOW_CONSEC_DAYS) {
    return {
      kind: 'SUSTAINED_LOW',
      evidence: {
        primary: moodSpark,
        secondary: effortSpark,
        numbers: { consecLow },
      },
    }
  }

  // EFFORT_CLIMBING: effort up by ratio AND mood trending down.
  if (
    prevEffortSum > 0 &&
    lastEffortSum >= prevEffortSum * INSIGHT_EFFORT_RATIO &&
    moodTrendingDown(prevMoodAvg, lastMoodAvg)
  ) {
    return {
      kind: 'EFFORT_CLIMBING',
      evidence: {
        primary: effortSpark,
        secondary: moodSpark,
        numbers: { lastEffortSum, prevEffortSum },
      },
    }
  }

  // DEADLINES_SLIP: >= INSIGHT_DEADLINES_MISSED_MIN missed in window.
  if (meta.deadlinesMissed >= INSIGHT_DEADLINES_MISSED_MIN) {
    return {
      kind: 'DEADLINES_SLIP',
      evidence: {
        primary: effortSpark,
        secondary: moodSpark,
        numbers: { deadlinesMissed: meta.deadlinesMissed },
      },
    }
  }

  // NOT_RECOVERING: active last-7 but zero coloring.
  if (
    meta.pointsLast7 >= INSIGHT_NOT_RECOVERING_POINTS &&
    meta.sectionsLast7 === 0
  ) {
    return {
      kind: 'NOT_RECOVERING',
      evidence: {
        primary: effortSpark,
        secondary: moodSpark,
        numbers: {
          pointsLast7: meta.pointsLast7,
          sectionsLast7: meta.sectionsLast7,
        },
      },
    }
  }

  // LATE_NIGHTS: last-7 late events >= ratio x previous AND >= min count.
  if (
    lastLateSum >= INSIGHT_LATE_MIN &&
    lastLateSum >= prevLateSum * INSIGHT_LATE_RATIO
  ) {
    return {
      kind: 'LATE_NIGHTS',
      evidence: {
        primary: lateSpark,
        secondary: moodSpark,
        numbers: { lastLateSum, prevLateSum },
      },
    }
  }

  // RECOVERING: mood trending up, effort flat or up.
  if (
    moodTrendingUp(prevMoodAvg, lastMoodAvg) &&
    lastEffortSum >= prevEffortSum
  ) {
    return {
      kind: 'RECOVERING',
      evidence: {
        primary: moodSpark,
        secondary: effortSpark,
        numbers: {
          lastMoodAvg: lastMoodAvg !== null ? round1(lastMoodAvg) : 0,
          prevMoodAvg: prevMoodAvg !== null ? round1(prevMoodAvg) : 0,
        },
      },
    }
  }

  return {
    kind: 'STEADY',
    evidence: {
      primary: moodSpark,
      secondary: effortSpark,
      numbers: {},
    },
  }
}

function longestLowRun(moods: Array<number | null>, max: number): number {
  let best = 0
  let run = 0
  for (const m of moods) {
    if (m !== null && m <= max) {
      run += 1
      if (run > best) best = run
    } else {
      run = 0
    }
  }
  return best
}

function round1(n: number): number {
  return Math.round(n * ONE_DECIMAL) / ONE_DECIMAL
}
