import { HTMLAttributes } from 'react'

type Props = HTMLAttributes<HTMLDivElement>

export function Card({ className = '', style, ...rest }: Props) {
  return (
    <div
      className={`bg-[var(--surface)] border border-[var(--border)] p-6 ${className}`}
      style={{
        borderRadius: 'var(--radius)',
        boxShadow: 'var(--shadow)',
        ...style,
      }}
      {...rest}
    />
  )
}
