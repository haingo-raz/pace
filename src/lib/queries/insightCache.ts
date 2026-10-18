import type { Sql, TransactionSql } from 'postgres'
import { sql } from '@/lib/db'

type Db = Sql | TransactionSql

export type InsightCacheRow = {
  kind: string
  numbers: Record<string, number>
  sentence: string
}

const UNDEFINED_TABLE = '42P01'

export async function getInsightCache(
  userId: string,
  day: string,
  tx: Db = sql,
): Promise<InsightCacheRow | null> {
  try {
    const [row] = await tx<InsightCacheRow[]>`
      select kind, numbers, sentence
      from insight_cache
      where user_id = ${userId} and day = ${day}
    `
    return row ?? null
  } catch (e) {
    if ((e as { code?: string }).code === UNDEFINED_TABLE) return null
    throw e
  }
}

export async function setInsightCache(
  userId: string,
  day: string,
  kind: string,
  numbers: Record<string, number>,
  sentence: string,
  tx: Db = sql,
): Promise<void> {
  try {
    await tx`
      insert into insight_cache (user_id, day, kind, numbers, sentence)
      values (${userId}, ${day}, ${kind}, ${JSON.stringify(numbers)}::jsonb, ${sentence})
      on conflict (user_id, day) do update
        set kind = excluded.kind,
            numbers = excluded.numbers,
            sentence = excluded.sentence,
            created_at = now()
    `
  } catch (e) {
    if ((e as { code?: string }).code === UNDEFINED_TABLE) return
    throw e
  }
}
