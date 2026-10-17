import { forwardRef, HTMLAttributes } from 'react'

type Props = HTMLAttributes<HTMLDivElement>

export const Card = forwardRef<HTMLDivElement, Props>(function Card(
  { className = '', style, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={`bg-[var(--surface)] border border-[var(--border)] p-6 ${className}`}
      style={{
        borderRadius: 'var(--radius)',
        boxShadow: 'var(--shadow)',
        ...style,
      }}
      {...rest}
    />
  )
})
