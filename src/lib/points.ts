import type { TransactionSql } from 'postgres'
import { sql } from '@/lib/db'
import { ApiError } from '@/lib/api'
import { logger } from '@/lib/logger'
import type { PointReason } from '@/config/constants'

/**
 * Award inside an existing transaction. The caller owns the tx and the log
 * line, so this function stays silent on success.
 */
export async function awardPointsTx(
  tx: TransactionSql,
  userId: string,
  amount: number,
  reason: PointReason,
): Promise<number> {
  await tx`
    insert into points_log (user_id, amount, reason)
    values (${userId}, ${amount}, ${reason})
  `
  const [p] = await tx<{ points_total: number }[]>`
    update profiles
    set points_total = points_total + ${amount}
    where user_id = ${userId}
    returning points_total
  `
  return p.points_total
}

/** Standalone single-transaction award with its own log line. */
export async function awardPoints(
  userId: string,
  amount: number,
  reason: PointReason,
): Promise<number> {
  const total = await sql.begin((tx) => awardPointsTx(tx, userId, amount, reason))
  logger.info({ event: 'points_award', userId, amount, reason, total })
  return total
}

/**
 * Mirror of awardPoints with a negative amount. The profiles.points_total
 * CHECK constraint rejects a negative balance; we let it fire and translate
 * it, so there is no read-then-write race window.
 */
export async function spendPoints(
  userId: string,
  amount: number,
  reason: PointReason,
): Promise<number> {
  if (amount <= 0) {
    throw new Error('spendPoints: amount must be positive')
  }
  try {
    const total = await sql.begin(async (tx) => {
      await tx`
        insert into points_log (user_id, amount, reason)
        values (${userId}, ${-amount}, ${reason})
      `
      const [p] = await tx<{ points_total: number }[]>`
        update profiles
        set points_total = points_total - ${amount}
        where user_id = ${userId}
        returning points_total
      `
      return p.points_total
    })
    logger.info({ event: 'points_spend', userId, amount: -amount, reason, total })
    return total
  } catch (e: unknown) {
    const code = (e as { code?: string } | null)?.code
    if (code === '23514') {
      throw new ApiError('INSUFFICIENT_POINTS', 'Not enough points yet.')
    }
    throw e
  }
}
