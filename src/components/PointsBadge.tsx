'use client'

import { copy } from '@/content/en'

type Props = {
  total: number
  delta?: number | null
}

export function PointsBadge({ total, delta }: Props) {
  const sign = delta && delta > 0 ? '+' : ''

  return (
    <span className="relative inline-flex items-center gap-1.5 rounded-full border border-[var(--accent)] bg-[var(--accent)]/25 px-3 py-1">
      <span className="text-[var(--primary-strong)] text-xs font-semibold uppercase tracking-wider">
        {copy.dashboard.pointsLabel}
      </span>
      <span
        className="text-[var(--text)] text-sm font-bold"
        style={{
          fontFamily: 'var(--font-jetbrains)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {total}
      </span>
      {delta ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-5 right-1 text-sm font-bold text-[var(--primary-strong)] points-delta"
          style={{
            fontFamily: 'var(--font-jetbrains)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {sign}
          {delta}
        </span>
      ) : null}
      <style>{`
        @keyframes points-delta-rise {
          0%   { opacity: 0; transform: translateY(4px); }
          20%  { opacity: 1; transform: translateY(0); }
          80%  { opacity: 1; transform: translateY(-8px); }
          100% { opacity: 0; transform: translateY(-14px); }
        }
        .points-delta {
          animation: points-delta-rise 1.2s ease-out both;
        }
      `}</style>
    </span>
  )
}
