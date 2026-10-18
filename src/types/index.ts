export type MoodScore = 1 | 2 | 3 | 4
export type Difficulty = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10

export type Task = {
  id: string
  user_id: string
  title: string
  difficulty: Difficulty | null
  deadline: string | null
  completed_at: string | null
  points_earned: number
  created_at: string
  group_id: string | null
  position: number
}

export type TaskGroup = {
  id: string
  user_id: string
  title: string
  position: number
  created_at: string
}

export type EmploymentStatus =
  | 'full_time'
  | 'part_time'
  | 'unemployed'
  | 'volunteer_full_time'
  | 'volunteer_part_time'
  | 'student_full_time'
  | 'student_part_time'

export type Profile = {
  user_id: string
  points_total: number
  streak_count: number
  last_visit_day: string | null
  last_streak_day: string | null
  timezone: string
  streak_paused: boolean
  employment_status: EmploymentStatus | null
  preferred_name: string | null
  onboarded_at: string | null
  created_at: string
}

export type Checkin = {
  day: string
  user_id: string
  mood_score: MoodScore
  created_at: string
}

export type ColoringSection = {
  id: string
  d: string
  label: string
}

export type ColoringPage = {
  id: string
  slug: string
  name: string
  view_box: string
  sections: ColoringSection[]
  total_sections: number
}

export type CheckinResponse = {
  pointsAwarded: number
  pointsTotal: number
}

export type ProposedTask = {
  title: string
  difficulty: number
  dayOffset: number
}

export type Plan = {
  isSmart: boolean
  missing: string[]
  sustainability: string
  reframedGoal: string
  groupName: string
  tasks: ProposedTask[]
}

export type UserDrawing = {
  id: string
  user_id: string
  page_id: string
  sections_state: Record<string, string>
  completed_at: string | null
  created_at: string
}

export type AssistantReply =
  | { kind: 'answer'; text: string }
  | { kind: 'needs_info'; text: string }
  | { kind: 'out_of_scope'; text: string }
  | { kind: 'no_match'; text: string }
  | { kind: 'ambiguous'; text: string }
  | { kind: 'action_done'; text: string; task?: Task }
