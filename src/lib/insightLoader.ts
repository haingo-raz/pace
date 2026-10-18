import 'server-only'
import { detectInsight, type Insight } from '@/lib/insights'
import { getInsightSeries } from '@/lib/queries/insights'
import {
  getInsightCache,
  setInsightCache,
} from '@/lib/queries/insightCache'
import { phrasedSentence } from '@/lib/insightCopy'

export type InsightPayload = {
  insight: Insight
  sentence: string
  /** True when the cache hit; false when the client should fetch /api/insight. */
  cached: boolean
}

function numbersEqual(
  a: Record<string, number>,
  b: Record<string, number>,
): boolean {
  const ak = Object.keys(a)
  const bk = Object.keys(b)
  if (ak.length !== bk.length) return false
  for (const k of ak) if (a[k] !== b[k]) return false
  return true
}


export async function loadInsightFast(
  userId: string,
  timezone: string,
  today: string,
  streak: number,
): Promise<InsightPayload> {
  const series = await getInsightSeries(userId, timezone, today)
  const insight = detectInsight(series.rows, {
    streak,
    deadlinesMissed: series.deadlinesMissed,
    pointsLast7: series.pointsLast7,
    sectionsLast7: series.sectionsLast7,
  })

  const needsPhrase =
    insight.kind !== 'STEADY' && insight.kind !== 'NEED_MORE_DATA'

  if (!needsPhrase) {
    return { insight, sentence: '', cached: true }
  }

  const cached = await getInsightCache(userId, today)
  const numbers = insight.evidence.numbers
  if (
    cached &&
    cached.kind === insight.kind &&
    numbersEqual(cached.numbers, numbers)
  ) {
    return { insight, sentence: cached.sentence, cached: true }
  }

  return { insight, sentence: '', cached: false }
}


export async function loadInsight(
  userId: string,
  timezone: string,
  today: string,
  streak: number,
  requestId: string,
): Promise<InsightPayload> {
  const fast = await loadInsightFast(userId, timezone, today, streak)
  if (fast.cached) return fast

  const sentence = await phrasedSentence(
    userId,
    fast.insight.kind,
    fast.insight.evidence.numbers,
    today,
    requestId,
  )

  if (sentence) {
    await setInsightCache(
      userId,
      today,
      fast.insight.kind,
      fast.insight.evidence.numbers,
      sentence,
    )
  }

  return { insight: fast.insight, sentence, cached: true }
}
