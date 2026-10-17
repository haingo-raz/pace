import type { Sql, TransactionSql } from 'postgres'
import { sql } from '@/lib/db'
import type { Difficulty, Task } from '@/types'

type Db = Sql | TransactionSql

const TASK_COLUMNS = sql`
  id, user_id, title, difficulty, deadline, completed_at, points_earned, created_at
`

type TaskRow = Omit<Task, 'deadline' | 'completed_at' | 'created_at'> & {
  deadline: Date | null
  completed_at: Date | null
  created_at: Date
}

function isoOrNull(d: Date | null): string | null {
  return d ? d.toISOString() : null
}

function toTask(row: TaskRow): Task {
  return {
    ...row,
    deadline: isoOrNull(row.deadline),
    completed_at: isoOrNull(row.completed_at),
    created_at: row.created_at.toISOString(),
  }
}

export async function listTasks(userId: string, tx: Db = sql): Promise<Task[]> {
  const rows = await tx<TaskRow[]>`
    select ${TASK_COLUMNS}
    from tasks
    where user_id = ${userId}
    order by completed_at nulls first, created_at desc
  `
  return rows.map(toTask)
}

export async function insertTask(
  userId: string,
  title: string,
  difficulty: Difficulty | null,
  deadline: string | null,
  tx: Db = sql,
): Promise<Task> {
  const [row] = await tx<TaskRow[]>`
    insert into tasks (user_id, title, difficulty, deadline)
    values (${userId}, ${title}, ${difficulty}, ${deadline})
    returning ${TASK_COLUMNS}
  `
  return toTask(row)
}

export async function completeTask(
  userId: string,
  taskId: string,
  onTimeAmount: number,
  completeAmount: number,
  tx: Db = sql,
): Promise<Task | null> {
  const [row] = await tx<TaskRow[]>`
    update tasks
    set completed_at = now(),
        points_earned = case
          when deadline is not null and now() <= deadline
            then ${onTimeAmount}::int
          else ${completeAmount}::int
        end
    where id = ${taskId}
      and user_id = ${userId}
      and completed_at is null
    returning ${TASK_COLUMNS}
  `
  return row ? toTask(row) : null
}

/**
 * Returns { task, firstRating }. firstRating is true only on the null -> value
 * transition, which is when the +5 is awarded.
 */
export async function rateTask(
  userId: string,
  taskId: string,
  difficulty: Difficulty,
  tx: Db = sql,
): Promise<{ task: Task; firstRating: boolean } | null> {
  const [firstRow] = await tx<TaskRow[]>`
    update tasks
    set difficulty = ${difficulty}
    where id = ${taskId}
      and user_id = ${userId}
      and difficulty is null
    returning ${TASK_COLUMNS}
  `
  if (firstRow) return { task: toTask(firstRow), firstRating: true }

  const [row] = await tx<TaskRow[]>`
    update tasks
    set difficulty = ${difficulty}
    where id = ${taskId} and user_id = ${userId}
    returning ${TASK_COLUMNS}
  `
  return row ? { task: toTask(row), firstRating: false } : null
}

export async function deleteTask(
  userId: string,
  taskId: string,
  tx: Db = sql,
): Promise<boolean> {
  const [row] = await tx<{ id: string }[]>`
    delete from tasks
    where id = ${taskId} and user_id = ${userId}
    returning id
  `
  return !!row
}
