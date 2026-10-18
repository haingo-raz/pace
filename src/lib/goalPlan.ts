import 'server-only'
import { z } from 'zod'
import { ApiError } from '@/lib/api'
import { genaiClient } from '@/lib/gemini'
import { logger } from '@/lib/logger'
import {
  DAY_OFFSET_MAX,
  DIFFICULTY_MAX,
  DIFFICULTY_MIN,
  GEMINI_MODEL,
  GEMINI_TIMEOUT_MS,
  MAX_GENERATED_TASKS,
  TASK_GROUP_TITLE_MAX,
  TASK_TITLE_MAX,
} from '@/config/constants'
import type { EmploymentStatus, MoodScore, Plan } from '@/types'

const EMPLOYMENT_PHRASE: Record<EmploymentStatus, string> = {
  full_time: 'working full-time (limited hours left in the day)',
  part_time: 'working part-time (some hours free each day)',
  unemployed: 'currently without paid work (most of the day available)',
  volunteer_full_time: 'volunteering full-time (committed most of the day)',
  volunteer_part_time: 'volunteering part-time (some hours free each day)',
  student_full_time: 'studying full-time (class, study, limited slack)',
  student_part_time: 'studying part-time (some hours free each day)',
}

const MOOD_PHRASE: Record<MoodScore, string> = {
  1: "the user feels rough today — favour fewer, lighter tasks and permission to rest",
  2: 'the user feels okay today — a steady, modest workload fits',
  3: 'the user feels good today — a normal workload is reasonable',
  4: 'the user feels great today — they can take on a bit more if they want',
}

export type GoalContext = {
  preferredName?: string | null
  employmentStatus?: EmploymentStatus | null
  mood?: MoodScore | null
}

function contextBlock(ctx: GoalContext): string {
  const lines: string[] = []
  if (ctx.preferredName) {
    lines.push(`Preferred name: ${ctx.preferredName} (never use it inside tasks).`)
  }
  if (ctx.employmentStatus) {
    lines.push(`Situation: ${EMPLOYMENT_PHRASE[ctx.employmentStatus]}.`)
  }
  if (ctx.mood !== null && ctx.mood !== undefined) {
    lines.push(`Today's mood: ${MOOD_PHRASE[ctx.mood]}.`)
  }
  if (lines.length === 0) return ''
  return `\n\nAbout the user (use as context, not as rigid rules):\n- ${lines.join('\n- ')}`
}

const SYSTEM_GUIDANCE = `You are a quiet, warm planner helping someone pace a job search.

Do three jobs, in order:
1. If the user's goal is vague, name which SMART attributes it is missing: specific, measurable, time-bound, relevant, assignable. Do not list all five if only one is missing.
2. If the goal implies an unsustainable pace, say so in one plain sentence and propose the sustainable version. Most job seekers can only sustain two or three applications a day. "Apply to 30 jobs this week" is six per day; push back on that. Sustainability matters more than ambition here.
3. Propose at most ${MAX_GENERATED_TASKS} concrete tasks. Each task is one specific action a person can finish in under an hour, with a difficulty from 1 (easy) to 10 (hard), and a dayOffset where 0 is today, 1 is tomorrow, up to ${DAY_OFFSET_MAX}.
4. Give the whole plan a short group name — two to four words, title case, describing the theme (e.g. 'Shopify application prep', 'Python basics').

When the user's situation is known, let it influence pacing. Someone working full-time has far fewer hours than someone unemployed; someone feeling rough today needs lighter, fewer tasks than someone feeling great. Use these as context, not as hard formulas — one unemployed user feeling great 
can comfortably do more today than another unemployed user feeling rough. Prefer small, confident steps over squeezing in the maximum.

Tone: plain, warm, never preachy. No exclamation marks. No "I" statements. If the input is not a goal at all (random letters, a question, a joke), return isSmart false, missing: ["specific"], sustainability: "", reframedGoal: a short note that this does not look like a goal, groupName: "Plan", and tasks: [].

Output JSON that matches the response schema exactly.`

const planJsonSchema = {
  type: 'object',
  properties: {
    isSmart: {
      type: 'boolean',
      description: 'True if the goal is already specific, measurable and time-bound.',
    },
    missing: {
      type: 'array',
      items: { type: 'string' },
      description: 'Which SMART attributes are absent.',
    },
    sustainability: {
      type: 'string',
      description: 'One sentence on whether the pace is survivable. Empty string if fine.',
    },
    reframedGoal: { type: 'string' },
    groupName: {
      type: 'string',
      description: 'Two to four words, title case, describing the theme.',
    },
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          difficulty: {
            type: 'integer',
            description: '1 to 10, how hard this feels',
          },
          dayOffset: {
            type: 'integer',
            description: '0 is today, 1 is tomorrow',
          },
        },
        required: ['title', 'difficulty', 'dayOffset'],
      },
    },
  },
  required: ['isSmart', 'sustainability', 'reframedGoal', 'groupName', 'tasks'],
}

const PlanResult = z.object({
  isSmart: z.boolean(),
  missing: z.array(z.string()).default([]),
  sustainability: z.string(),
  reframedGoal: z.string().trim().min(1),
  groupName: z.string().trim().min(1).max(TASK_GROUP_TITLE_MAX),
  tasks: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(TASK_TITLE_MAX),
        difficulty: z.number().int().min(DIFFICULTY_MIN).max(DIFFICULTY_MAX),
        dayOffset: z.number().int().min(0).max(DAY_OFFSET_MAX),
      }),
    )
    .max(MAX_GENERATED_TASKS),
})

export async function planGoal(
  goalText: string,
  requestId: string,
  ctx: GoalContext = {},
): Promise<Plan> {
  const started = Date.now()
  let timer: ReturnType<typeof setTimeout> | null = null
  try {
    const client = genaiClient()

    const interaction = (await Promise.race([
      client.interactions.create({
        model: GEMINI_MODEL,
        input: `${SYSTEM_GUIDANCE}${contextBlock(ctx)}\n\nUser's goal: "${goalText}"`,
        response_format: {
          type: 'text',
          mime_type: 'application/json',
          schema: planJsonSchema,
        },
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('gemini timeout')),
          GEMINI_TIMEOUT_MS,
        )
      }),
    ])) as { output_text?: string }

    const text = interaction.output_text
    if (typeof text !== 'string' || text.length === 0) {
      throw new Error('empty output_text')
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      throw new Error('gemini output was not valid JSON')
    }

    const plan = PlanResult.parse(parsed)
    logger.info({
      requestId,
      event: 'gemini_call',
      model: GEMINI_MODEL,
      ms: Date.now() - started,
      ok: true,
      tasks: plan.tasks.length,
    })
    return plan
  } catch (e: unknown) {
    const ms = Date.now() - started
    logger.warn({
      requestId,
      event: 'gemini_call',
      model: GEMINI_MODEL,
      ms,
      ok: false,
      message: e instanceof Error ? e.message : String(e),
    })
    throw new ApiError('AI_UNAVAILABLE', 'The planner is unavailable right now.')
  } finally {
    if (timer !== null) clearTimeout(timer)
  }
}
