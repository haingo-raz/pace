import 'server-only'
import { z } from 'zod'
import { genaiClient } from '@/lib/gemini'
import { logger } from '@/lib/logger'
import {
  GEMINI_MODEL,
  GEMINI_PHRASE_TIMEOUT_MS,
} from '@/config/constants'
import { copy, fill } from '@/content/en'
import type { InsightKind } from '@/lib/insights'

function writtenSentence(
  kind: InsightKind,
  numbers: Record<string, number>,
): string {
  const template = copy.insight.kind[kind]
  const vars: Record<string, string | number> = {}
  for (const [k, v] of Object.entries(numbers)) vars[k] = v
  return fill(template, vars)
}

const phraseJsonSchema = {
  type: 'object',
  properties: {
    sentence: { type: 'string', description: 'One short, warm sentence.' },
  },
  required: ['sentence'],
}

const PhraseResult = z.object({ sentence: z.string().trim().min(1).max(240) })

/**
 * Phrase the insight more naturally via Gemini.
 * Returns the written sentence on any failure. Never throws.
 * Caller is responsible for caching the result (see insight_cache).
 */
export async function phrasedSentence(
  _userId: string,
  kind: InsightKind,
  numbers: Record<string, number>,
  _todayYMD: string,
  requestId: string,
): Promise<string> {
  const written = writtenSentence(kind, numbers)
  if (!written) return ''

  function fallback(): string {
    return written
  }

  const prompt = `You rephrase a short wellbeing nudge for a job-seeking user. Keep it to one calm sentence of under 180 characters. Plain, warm, never preachy. No exclamation marks. No "I" statements. Do not add numbers that are not provided.

Pattern: ${kind}
Numbers: ${JSON.stringify(numbers)}
Written sentence: "${written}"

Return JSON {"sentence": "..."}.`

  const started = Date.now()
  let timer: ReturnType<typeof setTimeout> | null = null
  try {
    const client = genaiClient()
    const interaction = (await Promise.race([
      client.interactions.create({
        model: GEMINI_MODEL,
        input: prompt,
        response_format: {
          type: 'text',
          mime_type: 'application/json',
          schema: phraseJsonSchema,
        },
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('gemini timeout')),
          GEMINI_PHRASE_TIMEOUT_MS,
        )
      }),
    ])) as { output_text?: string }

    const text = interaction.output_text
    if (typeof text !== 'string' || text.length === 0) {
      throw new Error('empty output_text')
    }
    const parsed = PhraseResult.parse(JSON.parse(text))
    logger.info({
      requestId,
      event: 'gemini_call',
      model: GEMINI_MODEL,
      ms: Date.now() - started,
      ok: true,
      pattern: kind,
    })
    return parsed.sentence
  } catch (e: unknown) {
    logger.warn({
      requestId,
      event: 'gemini_call',
      model: GEMINI_MODEL,
      ms: Date.now() - started,
      ok: false,
      pattern: kind,
      message: e instanceof Error ? e.message : String(e),
    })
    return fallback()
  } finally {
    if (timer !== null) clearTimeout(timer)
  }
}
