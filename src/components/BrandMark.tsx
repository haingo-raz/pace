import Link from 'next/link'
import { copy } from '@/content/en'

type Props = {
  size?: 'sm' | 'lg'
  showWordmark?: boolean
}

export function BrandMark({ size = 'sm', showWordmark = true }: Props) {
  const dim = size === 'lg' ? 36 : 28
  return (
    <Link
      href="/dashboard"
      className="group inline-flex items-center gap-2 rounded-md focus:outline-none"
      aria-label={copy.app.name}
    >
      <svg
        role="img"
        aria-label={copy.app.brandMarkLabel}
        width={dim}
        height={dim}
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M4 24 Q 10 10, 20 14 T 32 10"
          stroke="var(--primary)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <path
          d="M26 6 L 32 10 L 28 16"
          stroke="var(--primary)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
      {showWordmark ? (
        <span
          className={
            'font-semibold tracking-tight text-[var(--text)] group-hover:text-[var(--primary-strong)] ' +
            (size === 'lg' ? 'text-2xl' : 'text-xl')
          }
          style={{
            fontFamily: 'var(--font-fraunces)',
            fontWeight: 600,
          }}
        >
          {copy.app.name}
        </span>
      ) : null}
    </Link>
  )
}
