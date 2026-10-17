import 'server-only'
import { detectInsight, type Insight } from '@/lib/insights'
import {
  getInsightSeries,
  hasDismissedToday,
} from '@/lib/queries/insights'
import { phrasedSentence } from '@/lib/insightCopy'

export type InsightPayload = {
  insight: Insight
  sentence: string
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

  if (await hasDismissedToday(userId, insight.kind, today)) {
    return { insight: { ...insight, kind: 'STEADY' }, sentence: '' }
  }

  const needsPhrase =
    insight.kind !== 'STEADY' && insight.kind !== 'NEED_MORE_DATA'
  const sentence = needsPhrase
    ? await phrasedSentence(
        userId,
        insight.kind,
        insight.evidence.numbers,
        today,
        requestId,
      )
    : ''

  return { insight, sentence }
}
