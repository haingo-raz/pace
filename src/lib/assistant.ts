import 'server-only'
import { z } from 'zod'
import { genaiClient } from '@/lib/gemini'
import { logger } from '@/lib/logger'
import {
  GEMINI_MODEL,
  GEMINI_TIMEOUT_MS,
} from '@/config/constants'
import { PACE_KNOWLEDGE } from '@/lib/knowledgeBase'
import type { EmploymentStatus, MoodScore, Task, TaskGroup } from '@/types'

const INTENT_KINDS = [
  'qna',
  'greeting',
  'create_task',
  'update_task_title',
  'update_task_deadline',
  'update_task_difficulty',
  'update_task_group',
  'complete_task',
  'uncomplete_task',
  'delete_task',
  'out_of_scope',
  'needs_info',
] as const

export type IntentKind = (typeof INTENT_KINDS)[number]

const intentSchema = z.object({
  intent: z.enum(INTENT_KINDS),
  taskMatch: z
    .object({
      title: z.string().trim().min(1).optional(),
    })
    .nullable()
    .optional(),
  create: z
    .object({
      title: z.string().trim().min(1).max(140),
      difficulty: z.number().int().min(1).max(10).nullable().optional(),
      deadlineIso: z.string().nullable().optional(),
      groupName: z.string().trim().nullable().optional(),
    })
    .nullable()
    .optional(),
  newTitle: z.string().trim().min(1).max(140).nullable().optional(),
  deadlineIso: z.string().nullable().optional(),
  difficulty: z.number().int().min(1).max(10).nullable().optional(),
  groupName: z.string().trim().nullable().optional(),
  answer: z.string().trim().optional(),
  followUp: z.string().trim().optional(),
})

export type Intent = z.infer<typeof intentSchema>

const intentJsonSchema = {
  type: 'object',
  properties: {
    intent: {
      type: 'string',
      enum: [...INTENT_KINDS],
      description: 'The user intent, picked from the fixed set.',
    },
    taskMatch: {
      type: 'object',
      properties: { title: { type: 'string' } },
      description: 'For task-targeted intents: the title text the user used.',
    },
    create: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        difficulty: { type: 'integer' },
        deadlineIso: { type: 'string' },
        groupName: { type: 'string' },
      },
      required: ['title'],
      description: 'For create_task: the task to create. groupName is optional.',
    },
    newTitle: { type: 'string', description: 'For update_task_title.' },
    deadlineIso: {
      type: 'string',
      description: 'ISO-8601 date-time for update_task_deadline.',
    },
    difficulty: {
      type: 'integer',
      description: 'For update_task_difficulty: integer 1-10.',
    },
    groupName: {
      type: 'string',
      description:
        'For update_task_group: the destination group name as the user wrote it. Empty string means ungroup.',
    },
    answer: {
      type: 'string',
      description:
        'For qna and greeting. For qna: one or two short sentences from the knowledge base. For greeting: a short friendly reply.',
    },
    followUp: {
      type: 'string',
      description:
        'For needs_info only. A single concise question to clarify the request.',
    },
  },
  required: ['intent'],
}

export type AssistantContext = {
  activeTasks: Array<Pick<Task, 'id' | 'title' | 'deadline'>>
  doneTasks: Array<Pick<Task, 'id' | 'title' | 'deadline'>>
  groups: Array<Pick<TaskGroup, 'id' | 'title'>>
  history: Array<{ role: 'user' | 'assistant'; text: string }>
  preferredName: string | null
  employmentStatus: EmploymentStatus | null
  mood: MoodScore | null
  timezone: string
  nowIso: string
}

function describeTasks(
  label: string,
  tasks: AssistantContext['activeTasks'],
): string {
  if (tasks.length === 0) return `${label}: (none)`
  const list = tasks
    .slice(0, 40)
    .map(
      (t) =>
        `  - "${t.title}"${t.deadline ? ` (due ${t.deadline})` : ''}`,
    )
    .join('\n')
  return `${label}:\n${list}`
}

function describeGroups(groups: AssistantContext['groups']): string {
  if (groups.length === 0) return 'Groups: (none)'
  return 'Groups:\n' + groups.map((g) => `  - "${g.title}"`).join('\n')
}

function describeHistory(history: AssistantContext['history']): string {
  if (history.length === 0) return ''
  const lines = history
    .slice(-8)
    .map(
      (m) =>
        `  ${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text.slice(0, 200)}`,
    )
    .join('\n')
  return `Recent conversation (oldest first):\n${lines}`
}

const SYSTEM = `You are the Pace in-app assistant. You help with exactly these things:
1. Short answers about Pace itself (features and how to do things), drawn from the knowledge base.
2. Managing the signed-in user's own tasks: create one (optionally inside a group), rename one, change its deadline, change its difficulty, move it to a group, mark complete, mark incomplete, delete.
3. Greetings. If the user says hi, hello, hey, sup, gm, good morning or any other greeting, pick intent "greeting".

You never answer general questions, do math problems, write resumes, draft emails, search the web, or discuss anything outside those topics. If asked, pick intent "out_of_scope".

For every request you MUST pick exactly one intent from the set and return JSON matching the response schema.

If the user's current message is a short answer to the assistant's previous question (visible in the recent conversation), merge the two: use the earlier message's intent plus the new information, and classify the merged request. For example, prior assistant question "Which task did you mean?" and user reply "my resume" plus an earlier user request "rename the task to Draft resume" together make intent "update_task_title" with taskMatch.title = "my resume" and newTitle = "Draft resume".

Rules per intent:
- "qna": only use the knowledge base. Keep "answer" to one or two short sentences. If the knowledge base does not cover the question, use "out_of_scope".
- "greeting": set "answer" to a short friendly line (one sentence), then one short sentence listing what you can do: add, rename, reschedule, change difficulty, move between groups, complete, reopen or delete tasks.
- "create_task": extract a concrete title (<= 140 chars). "difficulty" 1-10 is optional. "deadlineIso" must be a full ISO-8601 timestamp if given. "groupName" is optional. If the user said something like "add X to Wellness" or "create X in the Applications group", put the group name in create.groupName as the user wrote it. If no group was named, omit it.
- "update_task_title": set newTitle AND taskMatch.title (the existing title the user referenced). "Rename X to Y" means taskMatch.title=X and newTitle=Y. If only the new name is given with no old name, use "needs_info" with followUp "Which task should I rename?". If only the old name is given, use "needs_info" with followUp "What should I rename it to?".
- "update_task_deadline": set deadlineIso AND taskMatch.title. deadlineIso MUST be a full ISO-8601 timestamp.
- "update_task_difficulty": set difficulty (integer 1-10) AND taskMatch.title. "Set X difficulty to 7" or "Make X easier/harder" (pick a reasonable integer). If no number given and the user did not use easier/harder, use "needs_info".
- "update_task_group": set groupName AND taskMatch.title. "Move X to Wellness" or "X should be inside Wellness" => groupName="Wellness" and taskMatch.title="X". Only set groupName to the empty string when the user clearly says to remove/ungroup/unlink a task from its group with no destination (for example "remove X from its group" or "ungroup X"). NEVER omit groupName for this intent: if the user did not say any destination, use "needs_info" with followUp "Which group should I move it to?". The group name you return must be one of the groups listed under "Groups:" above; if the user named a group not in that list, still return it verbatim as groupName and the server will respond.
- "complete_task" / "uncomplete_task" / "delete_task": set taskMatch.title.
- "needs_info": the user clearly wants a supported action but a required field is missing (which task, what new title, what deadline, which difficulty, which group). Set "followUp" to one short clarifying question.
- "out_of_scope": for anything not covered above. Do not include an answer.

Never invent capabilities not in the knowledge base. Never produce extra fields. Never include the user's name inside task titles. Dates are relative to the user's "now" ISO value given below.

One task per request. If the user strings two task operations together ("add X and move Y to Z"), pick the FIRST one and use "needs_info" with followUp "I can only do one task at a time. Which should I do first: <A> or <B>?".`

export async function classifyIntent(
  userText: string,
  ctx: AssistantContext,
  requestId: string,
): Promise<Intent> {
  const started = Date.now()
  let timer: ReturnType<typeof setTimeout> | null = null
  try {
    const client = genaiClient()
    const context = [
      `Now (user timezone ${ctx.timezone}): ${ctx.nowIso}`,
      ctx.preferredName ? `Preferred name: ${ctx.preferredName}` : null,
      ctx.employmentStatus
        ? `Employment status: ${ctx.employmentStatus}`
        : null,
      ctx.mood !== null ? `Today's mood (1-4): ${ctx.mood}` : null,
      describeGroups(ctx.groups),
      describeTasks('Active tasks', ctx.activeTasks),
      describeTasks('Recently done tasks', ctx.doneTasks.slice(0, 15)),
      describeHistory(ctx.history),
    ]
      .filter(Boolean)
      .join('\n')

    const prompt = `${SYSTEM}

Knowledge base:
"""
${PACE_KNOWLEDGE}
"""

User context:
${context}

User request:
"""
${userText}
"""

Return JSON matching the response schema. Only JSON, nothing else.`

    const interaction = (await Promise.race([
      client.interactions.create({
        model: GEMINI_MODEL,
        input: prompt,
        response_format: {
          type: 'text',
          mime_type: 'application/json',
          schema: intentJsonSchema,
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
    const parsed = intentSchema.parse(JSON.parse(text))
    logger.info({
      requestId,
      event: 'assistant_intent',
      model: GEMINI_MODEL,
      ms: Date.now() - started,
      intent: parsed.intent,
      ok: true,
    })
    return parsed
  } catch (e: unknown) {
    logger.warn({
      requestId,
      event: 'assistant_intent',
      model: GEMINI_MODEL,
      ms: Date.now() - started,
      ok: false,
      message: e instanceof Error ? e.message : String(e),
    })
    throw e
  } finally {
    if (timer !== null) clearTimeout(timer)
  }
}

/**
 * Match a user-provided title to one of the user's own tasks.
 * - Exact (case-insensitive trim) match beats partial.
 * - If more than one partial match, returns 'ambiguous'.
 * - Returns null when nothing matches.
 */
export function matchTaskByTitle(
  query: string,
  tasks: Array<Pick<Task, 'id' | 'title' | 'completed_at'>>,
): { kind: 'one'; task: Pick<Task, 'id' | 'title' | 'completed_at'> }
  | { kind: 'ambiguous' }
  | { kind: 'none' } {
  const needle = query.trim().toLowerCase()
  if (!needle) return { kind: 'none' }

  const exact = tasks.filter((t) => t.title.trim().toLowerCase() === needle)
  if (exact.length === 1) return { kind: 'one', task: exact[0] }
  if (exact.length > 1) return { kind: 'ambiguous' }

  const partial = tasks.filter((t) =>
    t.title.toLowerCase().includes(needle),
  )
  if (partial.length === 1) return { kind: 'one', task: partial[0] }
  if (partial.length > 1) return { kind: 'ambiguous' }
  return { kind: 'none' }
}

/**
 * Match a user-provided group name to one of the user's own groups.
 * Case-insensitive exact first, then partial. Returns null when nothing matches.
 */
export function matchGroupByName(
  query: string,
  groups: Array<Pick<TaskGroup, 'id' | 'title'>>,
):
  | { kind: 'one'; group: Pick<TaskGroup, 'id' | 'title'> }
  | { kind: 'ambiguous' }
  | { kind: 'none' } {
  const needle = query.trim().toLowerCase()
  if (!needle) return { kind: 'none' }

  const exact = groups.filter((g) => g.title.trim().toLowerCase() === needle)
  if (exact.length === 1) return { kind: 'one', group: exact[0] }
  if (exact.length > 1) return { kind: 'ambiguous' }

  const partial = groups.filter((g) =>
    g.title.toLowerCase().includes(needle),
  )
  if (partial.length === 1) return { kind: 'one', group: partial[0] }
  if (partial.length > 1) return { kind: 'ambiguous' }
  return { kind: 'none' }
}
