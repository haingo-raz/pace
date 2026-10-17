import { orderTasks } from '../src/lib/ordering'
import type { Difficulty, MoodScore, Task } from '../src/types'

const now = new Date('2026-10-17T12:00:00.000Z')

function mkTask(
  id: string,
  title: string,
  difficulty: Difficulty | null,
  opts: { deadline?: string | null; completed?: boolean; createdAt?: string } = {},
): Task {
  const createdAt = opts.createdAt ?? '2026-10-16T10:00:00.000Z'
  return {
    id,
    user_id: 'u1',
    title,
    difficulty,
    deadline: opts.deadline ?? null,
    completed_at: opts.completed ? '2026-10-17T09:00:00.000Z' : null,
    points_earned: 0,
    created_at: createdAt,
  }
}

const tasks: Task[] = [
  mkTask('t1', 'easy 1', 1),
  mkTask('t2', 'light 2', 2),
  mkTask('t3', 'mid 5', 5),
  mkTask('t4', 'heavy 7', 7),
  mkTask('t5', 'hard 9', 9),
  mkTask('t6', 'unrated', null),
  mkTask('t7', 'overdue 4', 4, {
    deadline: '2026-10-15T12:00:00.000Z',
  }),
  mkTask('t8', 'done 3', 3, { completed: true }),
]

const moods: (MoodScore | null)[] = [null, 1, 2, 3, 4]
const labels: Record<string, string> = {
  null: 'No check-in',
  '1': 'Mood 1 Rough',
  '2': 'Mood 2 Okay',
  '3': 'Mood 3 Good',
  '4': 'Mood 4 Great',
}

type Row = { group: string; title: string; difficulty: string }

function toRows(group: string, list: Task[]): Row[] {
  return list.map((t) => ({
    group,
    title: t.title,
    difficulty: t.difficulty === null ? '—' : String(t.difficulty),
  }))
}

for (const mood of moods) {
  const key = mood === null ? 'null' : String(mood)
  console.log('')
  console.log('================================================')
  console.log(`${labels[key]}  (input: ${tasks.length} tasks)`)
  console.log('================================================')
  const result = orderTasks(tasks, mood, now)
  const total =
    result.primary.length + result.later.length + result.completed.length
  console.log(
    `primary=${result.primary.length}  later=${result.later.length}  completed=${result.completed.length}  total=${total}`,
  )
  const rows: Row[] = [
    ...toRows('primary', result.primary),
    ...toRows('later', result.later),
    ...toRows('completed', result.completed),
  ]
  console.table(rows)
  if (total !== tasks.length) {
    console.error(
      `FAIL: total ${total} does not equal input ${tasks.length} — a task was lost`,
    )
    process.exitCode = 1
  }
}

console.log('')
console.log('done')
