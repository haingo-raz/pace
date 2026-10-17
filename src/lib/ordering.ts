import {
  DIFFICULTY_HEAVY_MIN,
  DIFFICULTY_LIGHT_MAX,
} from '@/config/constants'
import type { MoodScore, Task } from '@/types'

export type OrderedTasks = {
  primary: Task[]
  later: Task[]
  completed: Task[]
}

function createdDesc(a: Task, b: Task): number {
  return b.created_at.localeCompare(a.created_at)
}

function isOverdue(t: Task, now: Date): boolean {
  return t.deadline !== null && new Date(t.deadline) < now
}

function byDeadlineThenRecency(a: Task, b: Task): number {
  if (a.deadline === null && b.deadline === null) return createdDesc(a, b)
  if (a.deadline === null) return 1
  if (b.deadline === null) return -1
  const d = a.deadline.localeCompare(b.deadline)
  return d !== 0 ? d : createdDesc(a, b)
}

function diffAsc(a: Task, b: Task): number {
  const d = (a.difficulty ?? 0) - (b.difficulty ?? 0)
  return d !== 0 ? d : createdDesc(a, b)
}

function diffDesc(a: Task, b: Task): number {
  const d = (b.difficulty ?? 0) - (a.difficulty ?? 0)
  return d !== 0 ? d : createdDesc(a, b)
}

export function orderTasks(
  tasks: Task[],
  mood: MoodScore | null,
  now: Date = new Date(),
): OrderedTasks {
  const completed = tasks
    .filter((t) => t.completed_at !== null)
    .sort((a, b) => {
      const ac = a.completed_at ?? a.created_at
      const bc = b.completed_at ?? b.created_at
      return bc.localeCompare(ac)
    })

  const incomplete = tasks.filter((t) => t.completed_at === null)
  const overdue = incomplete
    .filter((t) => isOverdue(t, now))
    .sort(byDeadlineThenRecency)
  const rest = incomplete.filter((t) => !isOverdue(t, now))
  const unrated = rest
    .filter((t) => t.difficulty === null)
    .sort(byDeadlineThenRecency)
  const rated = rest.filter((t) => t.difficulty !== null)

  let primaryRated: Task[] = []
  let later: Task[] = []

  switch (mood) {
    case 1: {
      const light = rated.filter(
        (t) => (t.difficulty as number) <= DIFFICULTY_LIGHT_MAX,
      )
      const heavy = rated.filter(
        (t) => (t.difficulty as number) > DIFFICULTY_LIGHT_MAX,
      )
      primaryRated = [...light].sort(diffAsc)
      later = [...heavy].sort(diffAsc)
      break
    }
    case 2:
      primaryRated = [...rated].sort(diffAsc)
      break
    case 3: {
      const middle = rated.filter((t) => {
        const d = t.difficulty as number
        return d > DIFFICULTY_LIGHT_MAX && d < DIFFICULTY_HEAVY_MIN
      })
      const heavy = rated.filter(
        (t) => (t.difficulty as number) >= DIFFICULTY_HEAVY_MIN,
      )
      const light = rated.filter(
        (t) => (t.difficulty as number) <= DIFFICULTY_LIGHT_MAX,
      )
      primaryRated = [
        ...middle.sort(diffAsc),
        ...heavy.sort(diffAsc),
        ...light.sort(diffAsc),
      ]
      break
    }
    case 4:
      primaryRated = [...rated].sort(diffDesc)
      break
    case null:
    default:
      primaryRated = [...rated].sort(byDeadlineThenRecency)
      break
  }

  return {
    primary: [...overdue, ...unrated, ...primaryRated],
    later,
    completed,
  }
}
