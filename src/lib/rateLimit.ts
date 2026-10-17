import 'server-only'

const buckets = new Map<string, number[]>()

export function hitRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: boolean; retryAfterMs: number } {
  const now = Date.now()
  const cutoff = now - windowMs
  const prior = buckets.get(key) ?? []
  const kept = prior.filter((t) => t >= cutoff)
  if (kept.length >= limit) {
    const retryAfterMs = Math.max(0, kept[0] + windowMs - now)
    buckets.set(key, kept)
    return { ok: false, retryAfterMs }
  }
  kept.push(now)
  buckets.set(key, kept)
  return { ok: true, retryAfterMs: 0 }
}
