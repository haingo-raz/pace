import type { Sql, TransactionSql } from 'postgres'
import { sql } from '@/lib/db'
import { ApiError } from '@/lib/api'
import { spendPointsTx } from '@/lib/points'
import {
  COST_COLOR_SECTION,
  POINT_REASONS,
} from '@/config/constants'
import type { ColoringPage, UserDrawing } from '@/types'

type Db = Sql | TransactionSql

type PageRow = Omit<ColoringPage, 'view_box'> & { view_box: string }

export async function getActivePage(tx: Db = sql): Promise<ColoringPage | null> {
  const [row] = await tx<PageRow[]>`
    select id, slug, name, view_box, sections, total_sections
    from coloring_pages
    order by slug
    limit 1
  `
  return row ?? null
}

type DrawingRow = Omit<UserDrawing, 'completed_at' | 'created_at'> & {
  completed_at: Date | null
  created_at: Date
}

function toDrawing(row: DrawingRow): UserDrawing {
  return {
    ...row,
    completed_at: row.completed_at ? row.completed_at.toISOString() : null,
    created_at: row.created_at.toISOString(),
  }
}

export async function getOrCreateDrawing(
  userId: string,
  pageId: string,
  tx: Db = sql,
): Promise<UserDrawing> {
  const [existing] = await tx<DrawingRow[]>`
    select id, user_id, page_id, sections_state, completed_at, created_at
    from user_drawings
    where user_id = ${userId} and page_id = ${pageId}
    order by (completed_at is null) desc, created_at desc
    limit 1
  `
  if (existing) return toDrawing(existing)

  await tx`
    insert into user_drawings (user_id, page_id)
    values (${userId}, ${pageId})
    on conflict do nothing
  `
  const [row] = await tx<DrawingRow[]>`
    select id, user_id, page_id, sections_state, completed_at, created_at
    from user_drawings
    where user_id = ${userId} and page_id = ${pageId}
    order by (completed_at is null) desc, created_at desc
    limit 1
  `
  if (!row) {
    throw new Error('getOrCreateDrawing: insert succeeded but select returned nothing')
  }
  return toDrawing(row)
}

export type FillResult = {
  state: Record<string, string>
  pointsTotal: number
  complete: boolean
}

export async function fillSection(
  userId: string,
  drawingId: string,
  sectionId: string,
  colour: string,
): Promise<FillResult> {
  return await sql.begin(async (tx) => {
    const [guard] = await tx<
      { already: boolean; total_sections: number }[]
    >`
      select (d.sections_state ? ${sectionId}) as already,
             p.total_sections
      from user_drawings d
      join coloring_pages p on p.id = d.page_id
      where d.id = ${drawingId}
        and d.user_id = ${userId}
        and d.completed_at is null
      for update of d
    `
    if (!guard) {
      throw new ApiError('NOT_FOUND', 'That page is not available.')
    }
    if (guard.already) {
      throw new ApiError('CONFLICT', 'That section is already filled.')
    }

    const pointsTotal = await spendPointsTx(
      tx,
      userId,
      COST_COLOR_SECTION,
      POINT_REASONS.COLOR_SECTION,
    )

    const [row] = await tx<{ sections_state: Record<string, string> }[]>`
      update user_drawings
      set sections_state = jsonb_set(
        sections_state, array[${sectionId}], to_jsonb(${colour}::text), true
      )
      where id = ${drawingId} and user_id = ${userId}
      returning sections_state
    `
    if (!row) {
      throw new ApiError('NOT_FOUND', 'That page is not available.')
    }

    const complete = Object.keys(row.sections_state).length >= guard.total_sections
    if (complete) {
      await tx`
        update user_drawings
        set completed_at = now()
        where id = ${drawingId}
          and user_id = ${userId}
          and completed_at is null
      `
    }

    return { state: row.sections_state, pointsTotal, complete }
  })
}
