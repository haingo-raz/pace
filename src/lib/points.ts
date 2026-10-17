import type { TransactionSql } from 'postgres'
import { ApiError } from '@/lib/api'
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

/**
 * Spend inside an existing transaction. The profiles.points_total CHECK
 * constraint rejects a negative balance; we translate 23514 into
 * INSUFFICIENT_POINTS so the whole tx rolls back together.
 */
export async function spendPointsTx(
  tx: TransactionSql,
  userId: string,
  amount: number,
  reason: PointReason,
): Promise<number> {
  if (amount <= 0) {
    throw new Error('spendPointsTx: amount must be positive')
  }
  try {
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
  } catch (e: unknown) {
    const code = (e as { code?: string } | null)?.code
    if (code === '23514') {
      throw new ApiError('INSUFFICIENT_POINTS', 'Not enough points yet.')
    }
    throw e
  }
}
