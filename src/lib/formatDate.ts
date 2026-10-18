/**
 * Short weekday + day + month in the user's stored timezone, e.g. "Fri 24 Oct".
 * Depends only on the ISO string and the timezone.
 */
export function formatShortDate(iso: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).formatToParts(new Date(iso))
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? ''
  const day = parts.find((p) => p.type === 'day')?.value ?? ''
  const month = parts.find((p) => p.type === 'month')?.value ?? ''
  return `${weekday} ${day} ${month}`.trim()
}
