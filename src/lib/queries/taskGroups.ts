import type { Sql, TransactionSql } from 'postgres'
import { sql } from '@/lib/db'
import type { TaskGroup } from '@/types'

type Db = Sql | TransactionSql

const GROUP_COLUMNS = sql`id, user_id, title, position, created_at`

type GroupRow = Omit<TaskGroup, 'created_at'> & { created_at: Date }

function toGroup(row: GroupRow): TaskGroup {
  return { ...row, created_at: row.created_at.toISOString() }
}

export async function listGroups(
  userId: string,
  tx: Db = sql,
): Promise<TaskGroup[]> {
  const rows = await tx<GroupRow[]>`
    select ${GROUP_COLUMNS}
    from task_groups
    where user_id = ${userId}
    order by position, created_at
  `
  return rows.map(toGroup)
}

export async function insertGroup(
  userId: string,
  title: string,
  tx: Db = sql,
): Promise<TaskGroup> {
  const [row] = await tx<GroupRow[]>`
    insert into task_groups (user_id, title, position)
    values (
      ${userId},
      ${title},
      coalesce(
        (select max(position) + 1000 from task_groups where user_id = ${userId}),
        1000
      )
    )
    returning ${GROUP_COLUMNS}
  `
  return toGroup(row)
}

export async function renameGroup(
  userId: string,
  groupId: string,
  title: string,
  tx: Db = sql,
): Promise<TaskGroup | null> {
  const [row] = await tx<GroupRow[]>`
    update task_groups
    set title = ${title}
    where id = ${groupId} and user_id = ${userId}
    returning ${GROUP_COLUMNS}
  `
  return row ? toGroup(row) : null
}

export async function deleteGroup(
  userId: string,
  groupId: string,
): Promise<boolean> {
  return await sql.begin(async (tx) => {
    await tx`
      update tasks set group_id = null
      where user_id = ${userId} and group_id = ${groupId}
    `
    const [row] = await tx<{ id: string }[]>`
      delete from task_groups
      where id = ${groupId} and user_id = ${userId}
      returning id
    `
    return !!row
  })
}

export async function groupBelongsToUser(
  userId: string,
  groupId: string,
  tx: Db = sql,
): Promise<boolean> {
  const [row] = await tx<{ id: string }[]>`
    select id from task_groups
    where id = ${groupId} and user_id = ${userId}
  `
  return !!row
}
