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

export async function loadInsight(
  userId: string,
  timezone: string,
  today: string,
  streak: number,
  requestId: string,
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
    return { insight, sentence: '' }
  }

  const cached = await getInsightCache(userId, today)
  const numbers = insight.evidence.numbers
  if (
    cached &&
    cached.kind === insight.kind &&
    numbersEqual(cached.numbers, numbers)
  ) {
    return { insight, sentence: cached.sentence }
  }

  const sentence = await phrasedSentence(
    userId,
    insight.kind,
    numbers,
    today,
    requestId,
  )

  if (sentence) {
    await setInsightCache(userId, today, insight.kind, numbers, sentence)
  }

  return { insight, sentence }
}
