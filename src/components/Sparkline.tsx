import { copy, fill } from '@/content/en'

type Props = {
  label: string
  values: Array<number | null>
  min: number
  max: number
}

const WIDTH = 120
const HEIGHT = 40
const PAD = 2

export function Sparkline({ label, values, min, max }: Props) {
  const present = values.filter((v): v is number => v !== null)
  const first = present[0] ?? null
  const last = present[present.length - 1] ?? null
  const trend =
    first === null || last === null
      ? copy.insight.sparkTrendFlat
      : last > first
        ? copy.insight.sparkTrendUp
        : last < first
          ? copy.insight.sparkTrendDown
          : copy.insight.sparkTrendFlat

  const span = Math.max(max - min, 1)
  const stepX = (WIDTH - PAD * 2) / Math.max(values.length - 1, 1)
  const y = (v: number) =>
    HEIGHT - PAD - ((v - min) / span) * (HEIGHT - PAD * 2)
  const x = (i: number) => PAD + i * stepX

  const segments: string[] = []
  let currentPath = ''
  values.forEach((v, i) => {
    if (v === null) {
      if (currentPath) {
        segments.push(currentPath)
        currentPath = ''
      }
      return
    }
    const point = `${currentPath === '' ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`
    currentPath += ` ${point}`
  })
  if (currentPath) segments.push(currentPath)

  const presentDots = values
    .map((v, i) => ({ v, i }))
    .filter((p): p is { v: number; i: number } => p.v !== null)

  const rangeMin = present.length ? Math.min(...present) : 0
  const rangeMax = present.length ? Math.max(...present) : 0
  const ariaLabel = `${label}. ${trend}. ${fill(copy.insight.sparkRange, {
    min: rangeMin,
    max: rangeMax,
  })}.`

  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="h-10 w-full max-w-[160px]"
    >
      <line
        x1={PAD}
        y1={HEIGHT - PAD}
        x2={WIDTH - PAD}
        y2={HEIGHT - PAD}
        stroke="var(--border)"
        strokeWidth={1}
      />
      {segments.map((d, i) => (
        <path
          key={i}
          d={d.trim()}
          fill="none"
          stroke="var(--primary-strong)"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {presentDots.map((p) => (
        <circle
          key={p.i}
          cx={x(p.i).toFixed(1)}
          cy={y(p.v).toFixed(1)}
          r={1.5}
          fill="var(--primary-strong)"
        />
      ))}
    </svg>
  )
}
